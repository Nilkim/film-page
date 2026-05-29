// 관리자 대시보드 인덱스 — 단순 진입점.
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { TABLE, FA_ORDERS_TABLE, PRICE_OVERRIDES_TABLE } from '@/lib/db';

export default async function AdminIndex() {
  // 관리자 영역 — service-role 로 RLS 무관하게 통계 카운트(주문/오버라이드 등).
  const supabase = createAdminClient();
  const [posts, overrides, orders] = await Promise.all([
    supabase.from(TABLE.POSTS).select('id', { count: 'exact', head: true }),
    supabase.from(PRICE_OVERRIDES_TABLE).select('package_code', { count: 'exact', head: true }),
    supabase.from(FA_ORDERS_TABLE).select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-ink">관리자 대시보드</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          label="주문"
          value={orders.count ?? 0}
          hint="결제·배송 처리"
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
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[6px] border border-card-line bg-card p-4 transition-colors hover:border-ink-60"
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-45">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-ink-60">{hint}</div>
    </Link>
  );
}
