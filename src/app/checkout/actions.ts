// 결제 서버 액션 — 사전 주문 생성(pending).
//
// 흐름:
//   1. 클라이언트가 카트/고객정보/PG provider 를 보낸다.
//   2. 이 액션이 order_no 채번 RPC 호출 → film_page_orders 에 'pending' 1행 insert.
//   3. order_no 반환 → 클라가 그 값으로 PortOne.requestPayment(paymentId=order_no).
//   4. 결제 완료 시 webhook 이 status='paid' 갱신.
//
// 보안: customer 입력은 길이/문자 검증만. 가격 합계는 서버에서 다시 계산하지 않고
// 클라이언트가 보낸 값을 그대로 저장(items 스냅샷에 포함). 이 정책의 한계 메모:
// 첫 버전은 익명 카트라 서버가 가격을 재검증할 단일 원천이 없음. 추후 webhook 단계에서
// PortOne 의 결제 금액과 우리 total 을 대조 검증해 위변조 방지.
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { FA_ORDERS_TABLE, NEXT_ORDER_NO_RPC } from '@/lib/db';
import { normalizePhone, type PgProvider } from '@/lib/portone';
import type { CartItem } from '@/lib/cart';

export type CreatePendingArgs = {
  items: CartItem[];
  customer: {
    name: string;
    phone: string;
    addr: string;
    addrDetail?: string;
    postal?: string;
    memo?: string;
  };
  pgProvider: PgProvider;
  subtotal: number;
  discount: number;
  total: number;
};

export type CreatePendingResult =
  | { ok: true; orderNo: string }
  | { ok: false; error: string };

// 입력 검증.
function validate(args: CreatePendingArgs): string | null {
  if (!args.items || args.items.length === 0) return '카트가 비어 있어요.';
  if (args.total <= 0) return '결제 금액이 0원이에요.';
  const c = args.customer;
  if (!c.name || c.name.trim().length < 2) return '이름을 2자 이상 입력해 주세요.';
  if (!normalizePhone(c.phone) || normalizePhone(c.phone).length < 9) {
    return '전화번호를 정확히 입력해 주세요.';
  }
  if (!c.addr || c.addr.trim().length < 5) return '주소를 입력해 주세요.';
  if (!['kakao', 'naver', 'google'].includes(args.pgProvider)) {
    return '결제 수단이 올바르지 않아요.';
  }
  return null;
}

export async function createPendingOrder(args: CreatePendingArgs): Promise<CreatePendingResult> {
  try {
    const invalid = validate(args);
    if (invalid) return { ok: false, error: invalid };

    const admin = createAdminClient();

    // 1. order_no 채번 (재시도 1회 — 동시성 경합 대비).
    let orderNo: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await admin.rpc(NEXT_ORDER_NO_RPC);
      if (error) return { ok: false, error: `채번 실패: ${error.message}` };
      const candidate = String(data ?? '').trim();
      if (!candidate) return { ok: false, error: '채번 결과가 비어 있어요.' };

      // 2. INSERT — order_no UNIQUE 충돌 시 다음 attempt.
      const { error: insErr } = await admin
        .from(FA_ORDERS_TABLE)
        .insert({
          order_no: candidate,
          customer_name: args.customer.name.trim(),
          customer_phone: normalizePhone(args.customer.phone),
          customer_addr: args.customer.addr.trim(),
          customer_addr_detail: args.customer.addrDetail?.trim() || null,
          customer_postal: args.customer.postal?.trim() || null,
          items: args.items,
          subtotal: args.subtotal,
          discount: args.discount,
          total: args.total,
          pg_provider: args.pgProvider,
          pg_status: 'pending',
          memo: args.customer.memo?.trim() || null,
        });
      if (!insErr) {
        orderNo = candidate;
        break;
      }
      // 23505 = unique 충돌 → 다음 시퀀스로 재시도
      const code = (insErr as { code?: string }).code;
      if (code !== '23505') {
        return { ok: false, error: insErr.message };
      }
    }

    if (!orderNo) return { ok: false, error: '주문번호 채번 충돌이 반복됐어요. 다시 시도해 주세요.' };
    return { ok: true, orderNo };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// 완료 페이지에서 status 조회 — 익명 RPC `get_order_by_phone_and_no` 사용도 가능하지만
// 결제 직후엔 phone+order_no 모두 있으므로 그 RPC 로 통일. 별도 액션 불필요.
