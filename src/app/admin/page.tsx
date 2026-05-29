// 관리자 대시보드 인덱스 — 단순 진입점.
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { TABLE, FA_ORDERS_TABLE, PRICE_OVERRIDES_TABLE } from '@/lib/db';

export default async function AdminIndex() {
  // 관리자 영역 — service-role 로 RLS 무관하게 통계 카운트.
  // 주문은 pg_status 별로 분리: paid(실제 결제 완료) / pending(결제 시도했지만 미완료) / failed(취소·실패).
  // pending 까지 한 카운트에 묶으면 "이탈한 사용자" 까지 주문수로 보여 부정확.
  const supabase = createAdminClient();
  const [posts, overrides, paidOrders, pendingOrders, failedOrders] = await Promise.all([
    supabase.from(TABLE.POSTS).select('id', { count: 'exact', head: true }),
    supabase.from(PRICE_OVERRIDES_TABLE).select('package_code', { count: 'exact', head: true }),
    supabase.from(FA_ORDERS_TABLE).select('id', { count: 'exact', head: true }).eq('pg_status', 'paid'),
    supabase.from(FA_ORDERS_TABLE).select('id', { count: 'exact', head: true }).eq('pg_status', 'pending'),
    supabase.from(FA_ORDERS_TABLE).select('id', { count: 'exact', head: true }).in('pg_status', ['failed', 'cancelled', 'refunded']),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-ink">관리자 대시보드</h1>

      {/* 모바일 1열, sm 이상 2열, lg 이상 3열로 자연스럽게 채워짐. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          href="/admin/posts"
          label="게시물"
          value={posts.count ?? 0}
          hint="패키지 단가 덮어쓰기"
        />
        <StatCard
          href="/admin/posts"
          label="활성 할인"
          value={overrides.count ?? 0}
          hint="가격 오버라이드 적용 중"
        />
        <StatCard
          href="/admin/orders"
          label="결제 완료 주문"
          value={paidOrders.count ?? 0}
          hint="실제 결제·발송 처리 대상"
          accent
        />
        <StatCard
          href="/admin/orders"
          label="결제 대기"
          value={pendingOrders.count ?? 0}
          hint="결제 시도 후 미완료(이탈 가능성)"
        />
        <StatCard
          href="/admin/orders"
          label="실패·취소·환불"
          value={failedOrders.count ?? 0}
          hint="결제 실패 / 사용자 취소 / 환불 완료 합산"
        />
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  hint,
  accent = false,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  // 핵심 카드(결제 완료 주문) — 잉크 진한 라벨 + 좌측 강조 보더로 시선 끌기
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'block rounded-[6px] border bg-card p-4 transition-colors hover:border-ink-60 ' +
        (accent ? 'border-ink' : 'border-card-line')
      }
    >
      <div
        className={
          'text-[11px] uppercase tracking-[0.18em] ' +
          (accent ? 'font-semibold text-ink' : 'text-ink-45')
        }
      >
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-ink-60">{hint}</div>
    </Link>
  );
}
