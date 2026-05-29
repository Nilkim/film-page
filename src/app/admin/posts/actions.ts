// 관리자 — 가격 오버라이드 set/clear 서버 액션.
//
// 흐름:
//   1. cookies() 기반 createClient() 로 user 가져오기.
//   2. isAdminEmail() 게이트 — 통과 못 하면 throw.
//   3. service-role 클라이언트(createAdminClient)로 upsert/delete (RLS 우회).
//   4. revalidatePath 로 카드/상세 가격 즉시 반영.
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertAdmin } from '@/lib/admin';
import { PRICE_OVERRIDES_TABLE } from '@/lib/db';

export type PriceOverrideResult = { ok: true } | { ok: false; error: string };

export async function setPriceOverride(formData: FormData): Promise<PriceOverrideResult> {
  try {
    const packageCode = String(formData.get('package_code') ?? '').trim();
    const overridePriceRaw = String(formData.get('override_price') ?? '').trim();
    const originalPriceRaw = String(formData.get('original_price') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim() || null;

    if (!packageCode) return { ok: false, error: 'package_code 누락' };

    const overridePrice = Number(overridePriceRaw);
    const originalPrice = Number(originalPriceRaw);
    if (!Number.isFinite(overridePrice) || overridePrice < 0) {
      return { ok: false, error: '새 가격은 0 이상 정수여야 해요.' };
    }
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      return { ok: false, error: '원가가 없는 패키지는 할인 적용 불가.' };
    }
    if (overridePrice >= originalPrice) {
      return { ok: false, error: '새 가격은 원가보다 낮아야 해요.' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const admin = createAdminClient();
    // .select().single() 로 RETURNING 받기 — 실제 들어간 row 확인.
    // 안 들어갔는데 silent success 처리되는 케이스(테이블 미존재 등) 즉시 잡힘.
    const { data, error } = await admin
      .from(PRICE_OVERRIDES_TABLE)
      .upsert(
        {
          package_code: packageCode,
          original_price: Math.round(originalPrice),
          override_price: Math.round(overridePrice),
          reason,
          set_by: user!.id,
          set_at: new Date().toISOString(),
        },
        { onConflict: 'package_code' },
      )
      .select()
      .single();

    if (error) {
      // 흔한 원인을 사람말로 풀어서 반환 — 사용자가 즉시 진단 가능.
      const msg = error.message;
      if (/relation .* does not exist/i.test(msg) || /could not find the table/i.test(msg)) {
        return { ok: false, error: `테이블 미존재: Supabase SQL Editor 에서 supabase/cart-payments.sql 을 먼저 실행하세요. (${msg})` };
      }
      if (/row-level security/i.test(msg) || /permission denied/i.test(msg)) {
        return { ok: false, error: `RLS 차단: SUPABASE_SERVICE_ROLE_KEY 가 Netlify 환경변수에 정확히 들어갔는지 확인하세요. (${msg})` };
      }
      return { ok: false, error: msg };
    }
    if (!data) {
      return { ok: false, error: '저장은 시도됐지만 RETURNING 데이터가 없습니다. 테이블 존재 여부 + service-role 키 확인 필요.' };
    }

    // 카드(홈) / 상세 모두 가격 반영.
    revalidatePath('/');
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function clearPriceOverride(formData: FormData): Promise<PriceOverrideResult> {
  try {
    const packageCode = String(formData.get('package_code') ?? '').trim();
    if (!packageCode) return { ok: false, error: 'package_code 누락' };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const admin = createAdminClient();
    const { error } = await admin
      .from(PRICE_OVERRIDES_TABLE)
      .delete()
      .eq('package_code', packageCode);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/');
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
