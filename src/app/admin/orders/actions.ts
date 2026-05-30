// 관리자 — 주문 발송 처리 서버 액션.
//
// 흐름:
//   1. cookies() 기반 createClient() 로 user 가져오기 + assertAdmin().
//   2. service-role 로 RLS 우회 update.
//   3. 발송(shipped) 전환 시 고객에게 발송알림 메일 발송 (notify_email 있을 때만).
//   4. revalidatePath 로 admin/orders + orders/lookup 갱신.
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertAdmin } from '@/lib/admin';
import { FA_ORDERS_TABLE } from '@/lib/db';
import { sendShippingNotification } from '@/lib/mail';

export type ActionResult = { ok: true } | { ok: false; error: string };

// 발송 단계 전진: awaiting → preparing
export async function markPreparing(orderNo: string): Promise<ActionResult> {
  return await transition(orderNo, { fulfillment_status: 'preparing' });
}

// 발송 처리: preparing → shipped + 운송장
export async function markShipped(
  orderNo: string,
  carrier: string,
  trackingNumber: string,
): Promise<ActionResult> {
  if (!carrier || !trackingNumber.trim()) {
    return { ok: false, error: '택배사와 운송장 번호가 모두 필요해요.' };
  }
  const result = await transition(orderNo, {
    fulfillment_status: 'shipped',
    tracking_carrier: carrier,
    tracking_number: trackingNumber.trim(),
    shipped_at: new Date().toISOString(),
  });
  if (!result.ok) return result;

  // 발송 알림 메일 — notify_email 있을 때만 + fire-and-forget.
  void (async () => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from(FA_ORDERS_TABLE)
        .select('customer_name, customer_notify_email, tracking_carrier, tracking_number')
        .eq('order_no', orderNo)
        .maybeSingle();
      if (data?.customer_notify_email) {
        await sendShippingNotification({
          to: data.customer_notify_email,
          orderNo,
          customerName: data.customer_name,
          carrier: data.tracking_carrier,
          trackingNumber: data.tracking_number,
        });
      }
    } catch (e) {
      console.warn('[admin] 발송알림 메일 실패:', (e as Error).message);
    }
  })();

  return { ok: true };
}

// 배송 완료: shipped → delivered
export async function markDelivered(orderNo: string): Promise<ActionResult> {
  return await transition(orderNo, {
    fulfillment_status: 'delivered',
    delivered_at: new Date().toISOString(),
  });
}

// 관리자 메모만 갱신.
export async function setAdminMemo(orderNo: string, memo: string): Promise<ActionResult> {
  return await transition(orderNo, { admin_memo: memo.trim() || null });
}

// 공통 — 권한 검증 + service-role update + revalidate.
async function transition(orderNo: string, patch: Record<string, unknown>): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const admin = createAdminClient();
    const { error } = await admin
      .from(FA_ORDERS_TABLE)
      .update(patch)
      .eq('order_no', orderNo);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin/orders');
    revalidatePath('/orders/lookup');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
