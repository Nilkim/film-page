// 주문 한 행 — 요약 보기 + 클릭 시 펼침(상세 + 발송 처리 폼).
//
// 인라인 발송: "준비 시작", "발송 처리(운송장 입력)", "배송 완료" 세 단계.
// 발송 처리 시 고객 알림 메일 자동 발송 (notify_email 있을 때만 — actions.ts 측).
'use client';

import { useState, useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import type { FaOrder } from '@/lib/db';
import { markPreparing, markShipped, markDelivered, setAdminMemo } from './actions';
import { CARRIER_LABELS, trackingUrl } from '@/lib/mail';

const CARRIERS: { key: string; label: string }[] = [
  { key: 'cj',     label: CARRIER_LABELS.cj },
  { key: 'hanjin', label: CARRIER_LABELS.hanjin },
  { key: 'lotte',  label: CARRIER_LABELS.lotte },
  { key: 'epost',  label: CARRIER_LABELS.epost },
  { key: 'custom', label: CARRIER_LABELS.custom },
];

export default function OrderRow({ order }: { order: FaOrder }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [carrier, setCarrier] = useState(order.tracking_carrier ?? 'cj');
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? '');
  const [memo, setMemo] = useState(order.admin_memo ?? '');

  const items = (order.items as Array<{ title: string; qty: number; price: number }> | null) ?? [];

  function withTransition(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? '저장됨' : (r.error ?? '에러'));
    });
  }

  const isPaid = order.pg_status === 'paid';
  const f = order.fulfillment_status;
  const trackUrl = trackingUrl(order.tracking_carrier, order.tracking_number);

  return (
    <li className="px-4 py-3">
      {/* 요약 행 — 클릭으로 펼치기 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-sm font-bold text-ink">{order.order_no}</span>
            <PgBadge status={order.pg_status} />
            {isPaid && <FulfillmentBadge status={f} />}
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-60">
            {order.customer_name} · {formatPhone(order.customer_phone)} · {new Date(order.created_at).toLocaleString('ko-KR')}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-sm font-bold text-ink tabular-nums">
            {order.total.toLocaleString('ko-KR')}원
          </div>
          <div className="mt-0.5 text-[10px] text-ink-45">{items.length}건</div>
        </div>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 flex-none text-ink-45 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polyline points="5 8 10 13 15 8" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-card-line pt-4 lg:grid-cols-[1fr_320px]">
          {/* 좌측: 항목 + 주소 + 메모 */}
          <div className="space-y-3 text-sm">
            <section>
              <H>주문 항목</H>
              <ul className="mt-1 space-y-1">
                {items.map((it, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span className="line-clamp-1 text-ink-70">
                      {it.title} {it.qty > 1 && <span className="text-ink-45">× {it.qty}</span>}
                    </span>
                    <span className="tabular-nums text-ink">
                      {(it.price * it.qty).toLocaleString('ko-KR')}원
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <H>배송지</H>
              <div className="mt-1 text-ink-70">
                {order.customer_postal && <span className="mr-2 text-ink-45">[{order.customer_postal}]</span>}
                {order.customer_addr}
                {order.customer_addr_detail && <span className="ml-1 text-ink-60">{order.customer_addr_detail}</span>}
              </div>
            </section>

            {order.customer_notify_email && (
              <section>
                <H>알림 이메일</H>
                <div className="mt-1 font-mono text-xs text-ink-70">{order.customer_notify_email}</div>
              </section>
            )}

            {order.memo && (
              <section>
                <H>고객 요청사항</H>
                <div className="mt-1 whitespace-pre-wrap text-ink-70">{order.memo}</div>
              </section>
            )}

            <section>
              <H>관리자 메모</H>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="내부 메모"
                  className="flex-1 rounded border border-card-line bg-bg px-2 py-1 text-sm focus:border-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => withTransition(() => setAdminMemo(order.order_no, memo))}
                  disabled={pending}
                  className="rounded border border-card-line px-2.5 py-1 text-xs text-ink-60 hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  저장
                </button>
              </div>
            </section>
          </div>

          {/* 우측: 발송 처리 */}
          <div className="space-y-3 rounded-[6px] border border-card-line bg-bg p-3 text-sm">
            <H>발송 처리</H>
            {!isPaid ? (
              <p className="text-xs text-ink-60">결제 완료된 주문만 발송 처리할 수 있어요.</p>
            ) : (
              <>
                {/* 발송 진행 단계 표시 */}
                <Steps current={f} />

                {/* 운송장 입력(언제든 갱신 가능) */}
                <div className="space-y-2">
                  <label className="block text-[11px] text-ink-60">택배사</label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full rounded border border-card-line bg-bg px-2 py-1.5 text-sm focus:border-ink focus:outline-none"
                  >
                    {CARRIERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <label className="block text-[11px] text-ink-60">운송장 번호</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="예: 123456789012"
                    className="w-full rounded border border-card-line bg-bg px-2 py-1.5 font-mono text-sm focus:border-ink focus:outline-none"
                  />
                  {trackUrl && (
                    <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-ink-60 underline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      현재 운송장 추적 <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  )}
                </div>

                {/* 액션 버튼들 — 현재 단계에 따라 다음 단계 강조 */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={pending || f === 'preparing' || f === 'shipped' || f === 'delivered'}
                    onClick={() => withTransition(() => markPreparing(order.order_no))}
                    className={btn(f === 'awaiting')}
                  >
                    1. 준비 시작
                  </button>
                  <button
                    type="button"
                    disabled={pending || f === 'delivered'}
                    onClick={() => withTransition(() => markShipped(order.order_no, carrier, trackingNumber))}
                    className={btn(f === 'preparing')}
                  >
                    2. 발송 처리 {order.customer_notify_email && <span className="ml-1 text-[10px] opacity-70">+ 메일 발송</span>}
                  </button>
                  <button
                    type="button"
                    disabled={pending || f !== 'shipped'}
                    onClick={() => withTransition(() => markDelivered(order.order_no))}
                    className={btn(f === 'shipped')}
                  >
                    3. 배송 완료
                  </button>
                </div>

                {msg && <div className="text-[11px] text-ink-60">{msg}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.18em] text-ink-45">{children}</div>;
}

function btn(primary: boolean): string {
  return (
    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-30 ' +
    (primary
      ? 'bg-ink text-bg hover:opacity-90'
      : 'border border-card-line text-ink-70 hover:border-ink hover:text-ink')
  );
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return raw;
}

function PgBadge({ status }: { status: FaOrder['pg_status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:      { label: '결제완료', cls: 'border-ink bg-ink text-bg' },
    pending:   { label: '결제대기', cls: 'border-ink-60 bg-ink-06 text-ink-60' },
    failed:    { label: '실패',     cls: 'border-red-300 bg-red-50 text-red-700' },
    cancelled: { label: '취소',     cls: 'border-card-line bg-bg text-ink-45' },
    refunded:  { label: '환불',     cls: 'border-card-line bg-bg text-ink-45' },
  };
  const c = map[status];
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] ${c.cls}`}>{c.label}</span>;
}

function FulfillmentBadge({ status }: { status: FaOrder['fulfillment_status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting:  { label: '대기',     cls: 'border-card-line text-ink-60' },
    preparing: { label: '준비중',   cls: 'border-amber-300 text-amber-700' },
    shipped:   { label: '발송됨',   cls: 'border-blue-300 text-blue-700' },
    delivered: { label: '배송완료', cls: 'border-green-300 text-green-700' },
  };
  const c = map[status];
  return <span className={`rounded-full border bg-bg px-2 py-0.5 text-[10px] ${c.cls}`}>{c.label}</span>;
}

// 발송 단계 시각화 — 4단계 진행바.
function Steps({ current }: { current: FaOrder['fulfillment_status'] }) {
  const order = ['awaiting', 'preparing', 'shipped', 'delivered'] as const;
  const idx = order.indexOf(current);
  const labels = ['대기', '준비', '발송', '완료'];
  return (
    <div className="flex items-center gap-1">
      {labels.map((label, i) => {
        const done = i <= idx;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div
              className={
                'h-1 w-full rounded-full transition-colors ' +
                (done ? 'bg-ink' : 'bg-ink-10')
              }
            />
            <span className={'mt-1 text-[10px] ' + (done ? 'font-semibold text-ink' : 'text-ink-45')}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
