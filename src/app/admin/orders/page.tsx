// 관리자 — 주문 리스트 + 필터(결제·발송 상태별) + 인라인 발송 처리.
//
// 한 행 = 한 주문. 클릭 시 펼쳐서 상세(항목·주소·메모) 표시.
// 발송 처리는 같은 행 안에서 인라인 폼 — 별도 상세 페이지 없이 한 화면에서 완결.
import { createAdminClient } from '@/lib/supabase/admin';
import { FA_ORDERS_TABLE, type FaOrder } from '@/lib/db';
import OrdersFilter from './OrdersFilter';
import OrderRow from './OrderRow';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ status?: string; fulfillment?: string }>;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { status = 'paid', fulfillment = 'all' } = await searchParams;

  const supabase = createAdminClient();
  let query = supabase
    .from(FA_ORDERS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  // 결제 상태 필터.
  if (status !== 'all') {
    query = query.eq('pg_status', status);
  }
  // 발송 상태 필터(결제완료 상태에서만 의미).
  if (fulfillment !== 'all') {
    query = query.eq('fulfillment_status', fulfillment);
  }

  const { data: rows } = await query;
  const orders = (rows ?? []) as FaOrder[];

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-ink">주문</h1>
        <span className="text-xs text-ink-60">{orders.length}건</span>
      </header>

      <OrdersFilter currentStatus={status} currentFulfillment={fulfillment} />

      <div className="overflow-hidden rounded-[6px] border border-card-line bg-card">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-60">조건에 맞는 주문이 없어요.</div>
        ) : (
          <ul className="divide-y divide-card-line">
            {orders.map((o) => <OrderRow key={o.id} order={o} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
