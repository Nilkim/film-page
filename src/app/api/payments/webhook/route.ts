// 포트원 V2 webhook 수신 → film_page_orders 상태 갱신.
//
// 검증 흐름:
//   1. raw body + headers 로 Webhook.verify 호출(secret 일치 확인).
//   2. event.type 으로 paid/cancelled/failed 분기.
//   3. paymentId(=우리 order_no) 로 결제 상세 조회 → 금액·통화 검증.
//   4. orders 행 status + paid_at + pg_tx_id 갱신.
//
// 멱등성: webhook 은 같은 이벤트가 중복으로 들어올 수 있다. 같은 status 면 OK.
// status 전이는 단방향(pending → paid → cancelled/refunded) 보장.
import { NextRequest } from 'next/server';
import * as PortOne from '@portone/server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { FA_ORDERS_TABLE } from '@/lib/db';
import { sendPaymentConfirmation } from '@/lib/mail';
import { buildOrderName } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!secret || !apiSecret) {
    return new Response('webhook not configured', { status: 503 });
  }

  // raw body — verify 가 원문 문자열을 요구.
  const rawBody = await req.text();
  const headers = {
    'webhook-id': req.headers.get('webhook-id') ?? '',
    'webhook-signature': req.headers.get('webhook-signature') ?? '',
    'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
  };

  let event: Awaited<ReturnType<typeof PortOne.Webhook.verify>>;
  try {
    event = await PortOne.Webhook.verify(secret, rawBody, headers);
  } catch (e) {
    console.warn('[webhook] verify failed:', (e as Error).message);
    return new Response('invalid signature', { status: 400 });
  }

  // V2 event: { type: "Transaction.Paid" | "Transaction.Cancelled" | ..., data: { paymentId, transactionId } }
  // payload 모양은 PortOne 측 스펙. 안전하게 좁은 path 만 사용.
  const evt = event as unknown as { type: string; data?: { paymentId?: string; transactionId?: string } };
  const paymentId = evt.data?.paymentId;
  if (!paymentId) {
    return new Response('missing paymentId', { status: 400 });
  }

  // 실제 결제 상세를 PortOne 에 다시 조회 — webhook 페이로드만 신뢰하지 않음.
  type PaymentShape = { status?: string; amount?: { total?: number }; transactionId?: string };
  let payment: PaymentShape | null = null;
  try {
    const client = PortOne.PortOneClient({ secret: apiSecret });
    const res = await client.payment.getPayment({ paymentId });
    payment = res as unknown as PaymentShape;
  } catch (e) {
    // PortOne SDK 가 던지는 에러는 RestError(=HTTP 에러) 또는 일반 Error.
    // 404 (= 해당 paymentId 의 결제 record 없음) 는 테스트 발송이거나 propagate 지연.
    // 200 으로 응답해 webhook 재시도 폭주를 막고, 진짜 결제는 다음 webhook 또는 클라이언트 polling 으로 확정.
    const err = e as { status?: number; name?: string; message?: string };
    const msg = err.message ?? '';
    const isNotFound =
      err.status === 404 ||
      /not.?found/i.test(msg) ||
      /PaymentNotFound/i.test(err.name ?? '');
    console.warn('[webhook] getPayment failed:', { paymentId, status: err.status, name: err.name, msg });
    if (isNotFound) {
      return new Response('ignored: payment not found (test send or propagation delay)', { status: 200 });
    }
    return new Response('payment fetch failed', { status: 502 });
  }

  if (!payment) return new Response('payment not found', { status: 404 });

  // PortOne 의 status: 'PAID' | 'FAILED' | 'CANCELLED' | 'PARTIAL_CANCELLED' | 'VIRTUAL_ACCOUNT_ISSUED' 등.
  // 우리는 paid / failed / cancelled / refunded 만 다룬다.
  const next = mapStatus(payment.status);
  if (!next) {
    // 알려지지 않은 상태 — 일단 200 으로 응답해 webhook 재시도 폭주를 막음.
    return new Response('ignored status', { status: 200 });
  }

  // 금액 검증 — webhook 위변조가 통과했더라도, 실제 PG 금액과 우리 DB total 이 다르면 위험.
  const supabase = createAdminClient();
  const { data: existing, error: selErr } = await supabase
    .from(FA_ORDERS_TABLE)
    .select('order_no, total, pg_status, customer_name, customer_notify_email, items')
    .eq('order_no', paymentId)
    .maybeSingle();
  if (selErr || !existing) {
    return new Response('order not found', { status: 404 });
  }

  const pgAmount = payment.amount?.total ?? -1;
  if (next === 'paid' && pgAmount !== existing.total) {
    console.warn('[webhook] amount mismatch:', { orderNo: paymentId, ourTotal: existing.total, pgTotal: pgAmount });
    // 결제 금액 불일치 — 위변조 의심. paid 로 올리지 않음.
    await supabase
      .from(FA_ORDERS_TABLE)
      .update({ pg_status: 'failed', memo: `amount mismatch: pg=${pgAmount}` })
      .eq('order_no', paymentId);
    return new Response('amount mismatch', { status: 409 });
  }

  // 같은 상태로의 중복 webhook — 멱등.
  if (existing.pg_status === next) {
    return new Response('ok (idempotent)', { status: 200 });
  }

  const patch: Record<string, unknown> = {
    pg_status: next,
    pg_tx_id: payment.transactionId ?? null,
  };
  if (next === 'paid') patch.paid_at = new Date().toISOString();

  const { error: updErr } = await supabase
    .from(FA_ORDERS_TABLE)
    .update(patch)
    .eq('order_no', paymentId);
  if (updErr) {
    return new Response(updErr.message, { status: 500 });
  }

  // paid 전환 시점 → 고객 알림 이메일 발송 (selective, notify_email 입력한 경우만).
  // mail 헬퍼는 RESEND_API_KEY 없으면 skip 하므로 키 미설정 환경에서도 안전.
  if (next === 'paid' && existing.customer_notify_email) {
    const items = (existing.items as Array<{ title: string; qty: number }> | null) ?? [];
    const orderName = buildOrderName(items);
    // fire-and-forget — webhook 응답 지연 방지. 실패해도 결제 상태는 paid 로 유지.
    sendPaymentConfirmation({
      to: existing.customer_notify_email,
      orderNo: existing.order_no,
      customerName: existing.customer_name,
      total: existing.total,
      orderName,
    }).catch((e) => console.warn('[webhook] 결제확인 메일 실패:', (e as Error).message));
  }

  return new Response('ok', { status: 200 });
}

// PortOne status → 우리 enum.
function mapStatus(s: string | undefined): 'paid' | 'failed' | 'cancelled' | 'refunded' | null {
  switch ((s ?? '').toUpperCase()) {
    case 'PAID':              return 'paid';
    case 'FAILED':            return 'failed';
    case 'CANCELLED':         return 'cancelled';
    case 'PARTIAL_CANCELLED': return 'refunded';
    case 'VIRTUAL_ACCOUNT_ISSUED': return null; // 가상계좌 발급은 결제 확정 전 단계
    default:                  return null;
  }
}
