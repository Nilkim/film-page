// 주문조회 — 전화번호 + 주문번호 매칭 시에만 결과 표시.
//
// 익명 사용자 친화적: RPC get_order_by_phone_and_no 가 두 값 동시 매칭 시에만 1행 반환,
// 부분 매칭은 빈 결과(=다른 사람 주문 노출 방지).
//
// URL 쿼리(?phone=X&orderNo=Y) 가 있으면 자동 실행 — 결제 완료 페이지에서 deep link.
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ORDER_LOOKUP_RPC } from '@/lib/db';
import { normalizePhone } from '@/lib/portone';
import PriceTag from '@/components/PriceTag';
import type { CartItem } from '@/lib/cart';

type OrderRow = {
  order_no: string;
  customer_name: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  pg_provider: string;
  pg_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  created_at: string;
  paid_at: string | null;
};

export default function LookupView() {
  const params = useSearchParams();
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [orderNo, setOrderNo] = useState(params.get('orderNo') ?? '');
  const [busy, setBusy] = useState(false);
  const [row, setRow] = useState<OrderRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setBusy(true);
    setErr(null);
    setSearched(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(ORDER_LOOKUP_RPC, {
        p_phone: normalizePhone(phone),
        p_order_no: orderNo.trim(),
      });
      if (error) {
        setErr(error.message);
        setRow(null);
        return;
      }
      const result = (Array.isArray(data) ? data[0] : data) as OrderRow | undefined;
      setRow(result ?? null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // URL 쿼리에 둘 다 있으면 자동 조회 1회.
  useEffect(() => {
    if (phone && orderNo) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold text-ink">주문조회</h1>
      <p className="mt-1 text-sm text-ink-60">
        결제 시 입력한 <b>전화번호</b>와 <b>주문번호</b>를 입력해 주세요.
      </p>

      <form onSubmit={handleLookup} className="mt-6 space-y-3 rounded-[6px] border border-card-line bg-card p-4">
        <label className="block">
          <span className="text-[11px] font-medium tracking-[0.04em] text-ink-60">전화번호</span>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium tracking-[0.04em] text-ink-60">주문번호</span>
          <input
            type="text"
            required
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="FA-20260527-0001"
            className={inputCls + ' font-mono'}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !phone || !orderNo}
          className="w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? '조회 중…' : '조회'}
        </button>
      </form>

      {err && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {searched && !busy && !err && !row && (
        <div className="mt-4 rounded border border-card-line bg-card p-4 text-center text-sm text-ink-60">
          일치하는 주문이 없어요. 전화번호와 주문번호를 다시 확인해 주세요.
        </div>
      )}

      {row && <OrderDetailCard row={row} />}
    </main>
  );
}

function OrderDetailCard({ row }: { row: OrderRow }) {
  const hasDiscount = row.discount > 0;
  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-[6px] border border-card-line bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-45">주문번호</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-ink">{row.order_no}</div>
          </div>
          <StatusBadge status={row.pg_status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="결제 수단" value={providerLabelShort(row.pg_provider)} />
          <Field label="받는 사람" value={row.customer_name} />
          <Field label="주문일시" value={new Date(row.created_at).toLocaleString('ko-KR')} />
          <Field
            label="결제완료"
            value={row.paid_at ? new Date(row.paid_at).toLocaleString('ko-KR') : '—'}
          />
        </div>
      </div>

      <div className="rounded-[6px] border border-card-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink">주문 항목</h2>
        <ul className="mt-3 divide-y divide-card-line">
          {row.items.map((it, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              {it.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.thumb}
                  alt=""
                  className="size-12 flex-none rounded border border-card-line object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid size-12 flex-none place-items-center rounded border border-card-line bg-ink-06 text-[9px] text-ink-45">
                  {it.source === 'post-package' ? '패키지' : '도면'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm text-ink">{it.title}</div>
                <div className="mt-0.5 text-xs text-ink-60 tabular-nums">
                  {it.qty} × {it.price.toLocaleString('ko-KR')}원
                </div>
              </div>
              <div className="flex-none text-right text-sm font-semibold text-ink tabular-nums">
                {(it.price * it.qty).toLocaleString('ko-KR')}원
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-card-line pt-3 text-sm">
          <Row label="상품 합계" value={`${row.subtotal.toLocaleString('ko-KR')}원`} />
          {hasDiscount && <Row label="할인" value={`- ${row.discount.toLocaleString('ko-KR')}원`} />}
          <div className="mt-2 flex items-baseline justify-between border-t border-card-line pt-2">
            <span className="text-sm font-semibold text-ink">총 결제금액</span>
            <PriceTag
              displayPrice={row.total}
              originalPrice={row.subtotal}
              hasDiscount={hasDiscount}
              size="lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: OrderRow['pg_status'] }) {
  const cfg = {
    paid:      { label: '결제 완료', cls: 'border-ink bg-ink text-bg' },
    pending:   { label: '결제 확인 중', cls: 'border-ink-60 bg-ink-06 text-ink-60' },
    failed:    { label: '결제 실패', cls: 'border-red-300 bg-red-50 text-red-700' },
    cancelled: { label: '취소', cls: 'border-card-line bg-bg text-ink-45' },
    refunded:  { label: '환불', cls: 'border-card-line bg-bg text-ink-45' },
  }[status];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-45">{label}</div>
      <div className="mt-0.5 text-sm text-ink">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-60">{label}</span>
      <span className="tabular-nums text-ink-70">{value}</span>
    </div>
  );
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

const inputCls =
  'mt-1 w-full rounded border border-card-line bg-bg px-3 py-2 text-sm text-ink ' +
  'focus:border-ink focus:outline-none';
