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
  total_price: number | null; // 해당 주문 총액 (unit_count × price_per_500). 패키지 합계 산출용.
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
    total_price: typeof row.total_price === 'number' ? row.total_price : null,
  }));
}

// 주문명 — 결제창 orderName / 알림 메일 상품 표기에 공통으로 쓰이는 문자열.
// 빈 목록은 '' (메일 측은 falsy 라 상품 행 자체를 렌더하지 않음).
//   1건  → title
//   N건  → `{title} 외 {N-1}건`
export function buildOrderName(items: Array<{ title: string; qty?: number }>): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].title;
  return `${items[0].title} 외 ${items.length - 1}건`;
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

// 패키지 이름(=package_code) 입력 규칙. 작성자가 직접 입력 — 한글/영문/숫자/공백.
export const PACKAGE_NAME_MIN = 2;
export const PACKAGE_NAME_MAX = 40;

// 이름 검증 — 길이 + 허용 문자(한글/영문/숫자/공백/일부 기호). 통과 시 null, 실패 시 사유.
export function validatePackageName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < PACKAGE_NAME_MIN) return `이름은 ${PACKAGE_NAME_MIN}자 이상이어야 해요.`;
  if (name.length > PACKAGE_NAME_MAX) return `이름은 ${PACKAGE_NAME_MAX}자 이하여야 해요.`;
  // 한글(완성형+자모), 영문, 숫자, 공백, - _ . 만 허용.
  if (!/^[가-힣㄰-㆏\w \-.]+$/.test(name)) {
    return '한글·영문·숫자와 공백, - _ . 만 사용할 수 있어요.';
  }
  return null;
}

// package_code(=이름)가 이미 사용 중인지. anon SELECT 허용이라 클라이언트에서도 호출 가능.
export async function isPackageCodeTaken(
  supabase: SupabaseClient,
  code: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(PACKAGES_TABLE)
    .select('package_code')
    .eq('package_code', code.trim())
    .maybeSingle();
  return !!data;
}

// 주문번호 묶음으로 패키지 생성. 이름(package_code)은 작성자가 입력한 값을 사용.
// 이름 중복은 사용자 오류 → 먼저 검사해 명확한 에러. user_seq는 자동 채번하며,
// (user_id, user_seq) 동시성 충돌(23505) 시 최대 5회 재시도.
export async function createPackage(
  supabase: SupabaseClient,
  user: Pick<User, 'id' | 'email'>,
  phone: string | null,
  orderCodes: string[],
  desiredCode: string,
): Promise<OrderPackage> {
  if (orderCodes.length === 0) {
    throw new Error('주문번호를 1개 이상 선택해 주세요.');
  }

  const packageCode = desiredCode.trim();
  const nameError = validatePackageName(packageCode);
  if (nameError) throw new Error(nameError);

  // 이름 중복 선검사 — 삽입 중 23505를 user_seq 경합과 구분하기 위함.
  if (await isPackageCodeTaken(supabase, packageCode)) {
    throw new Error('이미 사용 중인 패키지 이름이에요. 다른 이름을 입력해 주세요.');
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = await nextSeqForUser(supabase, user.id);

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

    const code = (error as { code?: string } | null)?.code;
    const msg = (error as { message?: string } | null)?.message ?? '';
    // package_code 중복(선검사 통과 후 경합) → 사용자 오류로 즉시 안내.
    if (code === '23505' && /package_code/i.test(msg)) {
      throw new Error('이미 사용 중인 패키지 이름이에요. 다른 이름을 입력해 주세요.');
    }
    // (user_id, user_seq) 동시성 충돌 → 재시도. 그 외 에러는 즉시 throw.
    if (code !== '23505') {
      throw new Error(error?.message ?? '패키지 생성 실패');
    }
  }
  throw new Error('패키지 생성 충돌이 반복됐어요. 다시 시도해 주세요.');
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
