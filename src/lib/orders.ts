// FilmCutting orders 연동 + 주문 패키지 생성.
//
// 책임:
//   1. 전화번호로 주문 목록 조회 — FilmCutting의 RPC 함수 호출
//      (orders 테이블은 RLS로 anon SELECT 차단되어 있어 직접 쿼리 불가.
//       대신 security definer로 만들어진 list_orders_by_phone() RPC 사용.)
//   2. 선택된 주문번호 묶음으로 패키지 생성. 코드 형식은 `{handle}-{NNN}`
//      (예: nilkim79-001). handle은 사용자 email의 @ 앞부분에서 도출.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ORDERS_RPC, PACKAGES_TABLE, type OrderPackage } from './db';
import type { ShapeData } from './shapeBounds';

// RPC `list_orders_by_phone` 반환 한 행 — 썸네일 렌더에 필요한 부분.
export type FilmSnapshot = {
  name?: string;
  color_hex?: string;
  price_per_500?: number;
};

export type OrderSummary = {
  code: string;
  created_at: string;
  shapes_json: ShapeData[] | null;
  film_snapshot: FilmSnapshot | null;
};

// 전화번호로 주문 목록 조회. FilmCutting의 RPC 함수를 호출.
// RPC 내부에서 `phone = regexp_replace(p_phone, '\D', '', 'g')`로 정규화 비교
// 하므로, 우리는 어떤 표기로 보내도 무방 (010-1234-5678, 01012345678 모두 OK).
export async function findOrdersByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<OrderSummary[]> {
  const trimmed = phone.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.rpc(ORDERS_RPC, { p_phone: trimmed });
  if (error) {
    // RPC 함수 미존재 / 권한 문제 / 네트워크 등은 정상 경로로 빈 배열.
    console.warn('[orders] rpc failed:', error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    code: String(row.order_code),
    created_at: String(row.created_at),
    shapes_json: (row.shapes_json as ShapeData[] | null) ?? null,
    film_snapshot: (row.film_snapshot as FilmSnapshot | null) ?? null,
  }));
}

// 사용자 식별자 도출.
//   - 이메일 있으면 @ 앞부분 → 영문숫자/하이픈만 남기고 소문자화
//   - 너무 짧거나 이메일 없으면 user.id 앞 8자
//
// 예: nilkim79@gmail.com → 'nilkim79'
//     ko.kim+test@gmail.com → 'kokimtest' (+/. 제거)
export function userHandle(user: Pick<User, 'id' | 'email'>): string {
  const email = user.email ?? '';
  if (email.includes('@')) {
    const local = email.split('@')[0]?.toLowerCase() ?? '';
    const cleaned = local.replace(/[^a-z0-9-]/g, '');
    if (cleaned.length >= 2) return cleaned;
  }
  return user.id.replace(/-/g, '').slice(0, 8);
}

// 주문번호 묶음으로 패키지 생성. `{handle}-{NNN}` 형식, 사용자별 일련번호.
// (user_id, user_seq) unique 제약 위반 시 최대 5회까지 재시도(동시성 보호).
export async function createPackage(
  supabase: SupabaseClient,
  user: Pick<User, 'id' | 'email'>,
  phone: string | null,
  orderCodes: string[],
): Promise<OrderPackage> {
  if (orderCodes.length === 0) {
    throw new Error('주문번호를 1개 이상 선택해 주세요.');
  }

  const handle = userHandle(user);

  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = await nextSeqForUser(supabase, user.id);
    const packageCode = `${handle}-${String(seq).padStart(3, '0')}`;

    const { data, error } = await supabase
      .from(PACKAGES_TABLE)
      .insert({
        package_code: packageCode,
        user_id: user.id,
        user_seq: seq,
        phone: phone || null,
        order_codes: orderCodes,
      })
      .select('*')
      .single();

    if (!error && data) return data as OrderPackage;

    // 23505 = unique 위반. (user_id, user_seq) 또는 package_code 충돌이면 재시도.
    const isDup = (error as { code?: string } | null)?.code === '23505';
    if (!isDup) {
      throw new Error(error?.message ?? '패키지 생성 실패');
    }
  }
  throw new Error('패키지 코드 생성 충돌이 반복됐어요. 다시 시도해 주세요.');
}

// 패키지 단건 조회 — 상세 페이지에서 package_code로 가져올 때.
export async function findPackageByCode(
  supabase: SupabaseClient,
  packageCode: string,
): Promise<OrderPackage | null> {
  const { data, error } = await supabase
    .from(PACKAGES_TABLE)
    .select('*')
    .eq('package_code', packageCode)
    .maybeSingle();
  if (error || !data) return null;
  return data as OrderPackage;
}

// 사용자의 다음 user_seq 후보값.
async function nextSeqForUser(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from(PACKAGES_TABLE)
    .select('user_seq')
    .eq('user_id', userId)
    .order('user_seq', { ascending: false })
    .limit(1);
  const last = (data?.[0] as { user_seq?: number } | undefined)?.user_seq ?? 0;
  return last + 1;
}
