// 결제 완료 화면 — client. URL 쿼리에서 orderNo + phone 받아 상태 표시.
//
// 결제 직후 webhook 이 status='paid' 로 갱신할 시간이 1~3초 걸릴 수 있으므로
// 3초 간격으로 최대 5회 polling. 그래도 pending 이면 사용자 새로고침 안내.
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ORDER_LOOKUP_RPC } from '@/lib/db';
import { normalizePhone } from '@/lib/portone';

type OrderRow = {
  order_no: string;
  customer_name: string;
  items: unknown;
  subtotal: number;
  discount: number;
  total: number;
  pg_provider: string;
  pg_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  created_at: string;
  paid_at: string | null;
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX = 5;

export default function CompleteView() {
  const params = useSearchParams();
  const orderNo = params.get('orderNo') ?? '';
  const phone = params.get('phone') ?? '';
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [tries, setTries] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNo || !phone) {
      setErr('주문 정보를 찾을 수 없어요.');
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    async function fetchOnce(attempt: number) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc(ORDER_LOOKUP_RPC, {
          p_phone: normalizePhone(phone),
          p_order_no: orderNo,
        });
        if (cancelled) return;
        if (error) {
          setErr(error.message);
          return;
        }
        const row = (Array.isArray(data) ? data[0] : data) as OrderRow | undefined;
        if (row) {
          setOrder(row);
          setTries(attempt);
          if (row.pg_status === 'pending' && attempt < POLL_MAX) {
            timer = window.setTimeout(() => fetchOnce(attempt + 1), POLL_INTERVAL_MS);
          }
          return;
        }
        // 행이 아직 없을 가능성(트랜잭션 지연) — 재시도.
        if (attempt < POLL_MAX) {
          timer = window.setTimeout(() => fetchOnce(attempt + 1), POLL_INTERVAL_MS);
        } else {
          setErr('주문을 찾을 수 없어요. 잠시 후 주문조회에서 다시 시도해 주세요.');
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    }
    fetchOnce(1);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderNo, phone]);

  const status = order?.pg_status ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold text-ink">결제 완료</h1>

      {err && (
        <div className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="mt-6 rounded-[6px] border border-card-line bg-card p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-45">주문번호</div>
        <div className="mt-1 font-mono text-lg font-bold text-ink">{orderNo || '—'}</div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <Stat label="상태" value={statusLabel(status)} accent={status === 'paid'} />
          <Stat label="결제수단" value={order ? providerLabelShort(order.pg_provider) : '—'} />
          <Stat label="받는 사람" value={order?.customer_name ?? '—'} />
          <Stat
            label="총액"
            value={order ? `${order.total.toLocaleString('ko-KR')}원` : '—'}
          />
        </div>

        {status === 'pending' && tries < POLL_MAX && (
          <p className="mt-4 text-xs text-ink-60">
            결제 확인 중이에요… ({tries}/{POLL_MAX})
          </p>
        )}
        {status === 'pending' && tries >= POLL_MAX && (
          <p className="mt-4 text-xs text-ink-60">
            결제 확인이 조금 늦어지고 있어요. 잠시 후{' '}
            <Link href={`/orders/lookup?phone=${encodeURIComponent(phone)}&orderNo=${encodeURIComponent(orderNo)}`} className="underline">
              주문조회
            </Link>
            에서 다시 확인해 주세요.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-ink hover:underline">← 홈으로</Link>
        <Link href={`/orders/lookup?phone=${encodeURIComponent(phone)}&orderNo=${encodeURIComponent(orderNo)}`} className="text-ink hover:underline">
          주문조회 →
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-45">{label}</div>
      <div className={'mt-1 ' + (accent ? 'text-base font-bold text-ink' : 'text-sm text-ink-70')}>
        {value}
      </div>
    </div>
  );
}

function statusLabel(s: OrderRow['pg_status'] | null): string {
  switch (s) {
    case 'paid':      return '결제 완료';
    case 'pending':   return '결제 확인 중';
    case 'failed':    return '결제 실패';
    case 'cancelled': return '결제 취소';
    case 'refunded':  return '환불 완료';
    default:          return '—';
  }
}

function providerLabelShort(p: string): string {
  switch (p) {
    case 'kakao':  return '카카오페이';
    case 'naver':  return '네이버페이';
    case 'google': return '구글페이';
    case 'card':   return '신용카드';
    case 'test':   return '테스트';
    default:       return p;
  }
}
