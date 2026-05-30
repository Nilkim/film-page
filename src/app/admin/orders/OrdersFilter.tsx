// 주문 리스트 필터 — URL searchParams 로 결제·발송 상태 분기.
//
// 서버 컴포넌트가 ?status=&fulfillment= 를 읽어 쿼리. 여기서는 칩 toggle 만.
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const PG_STATUSES: { key: string; label: string }[] = [
  { key: 'paid',      label: '결제완료' },
  { key: 'pending',   label: '결제대기' },
  { key: 'failed',    label: '실패' },
  { key: 'cancelled', label: '취소' },
  { key: 'refunded',  label: '환불' },
  { key: 'all',       label: '전체' },
];

const FULFILLMENT_STATUSES: { key: string; label: string }[] = [
  { key: 'all',        label: '전체' },
  { key: 'awaiting',   label: '대기' },
  { key: 'preparing',  label: '준비중' },
  { key: 'shipped',    label: '발송됨' },
  { key: 'delivered',  label: '배송완료' },
];

function FilterInner({
  currentStatus,
  currentFulfillment,
}: {
  currentStatus: string;
  currentFulfillment: string;
}) {
  const sp = useSearchParams();
  function href(next: { status?: string; fulfillment?: string }): string {
    const p = new URLSearchParams(sp.toString());
    if (next.status !== undefined) p.set('status', next.status);
    if (next.fulfillment !== undefined) p.set('fulfillment', next.fulfillment);
    return `/admin/orders?${p.toString()}`;
  }

  return (
    <div className="space-y-2 text-[11px] tracking-[0.06em]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-ink-45">결제</span>
        {PG_STATUSES.map((s) => (
          <Link key={s.key} href={href({ status: s.key })} className={chip(currentStatus === s.key)}>
            {s.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-ink-45">발송</span>
        {FULFILLMENT_STATUSES.map((s) => (
          <Link key={s.key} href={href({ fulfillment: s.key })} className={chip(currentFulfillment === s.key)}>
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function OrdersFilter(props: { currentStatus: string; currentFulfillment: string }) {
  return (
    <Suspense fallback={<div className="h-16" />}>
      <FilterInner {...props} />
    </Suspense>
  );
}

function chip(active: boolean): string {
  return (
    'whitespace-nowrap border px-2.5 py-[5px] transition-colors duration-150 ' +
    (active
      ? 'border-ink bg-ink text-bg'
      : 'border-card-line text-ink-60 hover:border-ink-60 hover:text-ink')
  );
}
