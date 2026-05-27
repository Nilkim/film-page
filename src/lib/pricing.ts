// 패키지 가격 — 원가 + 관리자 오버라이드 통합 조회.
//
// 가격 정책:
//   - 원가(original): FilmCutting orders.total_price 의 합 (listOrdersByPhone 결과).
//   - 노출가(display): film_page_price_overrides.override_price 가 있으면 그 값, 없으면 원가.
//   - 할인 시 UI: 원가에 취소선 + 노출가를 강조 (PriceTag 컴포넌트).
//
// 같은 패키지를 여러 화면에서 조회하므로, 캐시·일괄 조회 헬퍼를 함께 둔다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRICE_OVERRIDES_TABLE, type PriceOverride } from './db';

// 단일 패키지의 오버라이드 조회. 없으면 null.
export async function findPriceOverride(
  supabase: SupabaseClient,
  packageCode: string,
): Promise<PriceOverride | null> {
  const { data, error } = await supabase
    .from(PRICE_OVERRIDES_TABLE)
    .select('package_code, original_price, override_price, reason, set_at')
    .eq('package_code', packageCode)
    .maybeSingle();
  if (error || !data) return null;
  return data as PriceOverride;
}

// 여러 패키지의 오버라이드 일괄 조회. PostCard 그리드처럼 N개를 한 번에 매핑할 때.
// 반환: Map<package_code, PriceOverride>
export async function findPriceOverrides(
  supabase: SupabaseClient,
  packageCodes: string[],
): Promise<Map<string, PriceOverride>> {
  const codes = Array.from(new Set(packageCodes.filter(Boolean)));
  if (codes.length === 0) return new Map();

  const { data, error } = await supabase
    .from(PRICE_OVERRIDES_TABLE)
    .select('package_code, original_price, override_price, reason, set_at')
    .in('package_code', codes);
  if (error || !data) return new Map();

  return new Map((data as PriceOverride[]).map((row) => [row.package_code, row]));
}

// 한 화면에서 표시할 두 가격값. 호출 측이 UI 분기에 그대로 사용.
//   - displayPrice: 실제 노출가(취소선 위 큰 가격)
//   - originalPrice: 원가(취소선용). 오버라이드 없으면 displayPrice 와 동일.
//   - hasDiscount: 두 값이 다른지(취소선 렌더 여부).
export type ResolvedPrice = {
  displayPrice: number;
  originalPrice: number;
  hasDiscount: boolean;
};

// 원가와 오버라이드 행에서 표시용 가격 계산.
// 오버라이드의 original_price 보다 실시간 원가가 다른 경우(예: FilmCutting 측 가격 변경)
// 가장 신뢰할 수 있는 "원가" 는 실시간 합계. 오버라이드는 노출가만 반영하고 취소선은 실시간 원가.
export function resolvePrice(
  liveOriginal: number,
  override: PriceOverride | null,
): ResolvedPrice {
  if (!override) {
    return { displayPrice: liveOriginal, originalPrice: liveOriginal, hasDiscount: false };
  }
  // override_price 가 실시간 원가보다 크면(예외적 케이스) 오버라이드 무시 — 인상 금지.
  if (override.override_price >= liveOriginal) {
    return { displayPrice: liveOriginal, originalPrice: liveOriginal, hasDiscount: false };
  }
  return {
    displayPrice: override.override_price,
    originalPrice: liveOriginal,
    hasDiscount: true,
  };
}
