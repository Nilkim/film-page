// 관리자 권한 판정 — env ADMIN_EMAILS 화이트리스트 기반.
//
// 정책:
//   - ADMIN_EMAILS 콤마 분리 문자열(예: "a@b.com,c@d.com"). 공백 trim, 소문자 비교.
//   - DB 의 film_page_admin_emails 테이블은 보조(미사용 가능). 이 모듈은 env 만 사용.
//   - 권한 검사가 필요한 자리는 모두 이 헬퍼로 단일화 — 관리자 정의가 바뀔 때 한 곳만 수정.
//
// 보안: 이 모듈은 server-only 가 아니다. 이메일 일치 자체는 비밀이 아니지만,
// 실제 권한 액션(서버 액션/Route Handler) 에서는 반드시 createClient() 로
// auth.getUser() 한 뒤 그 email 로 isAdminEmail() 호출. 클라이언트에서
// 보낸 email 값을 신뢰하지 말 것.

// 두 env 를 합쳐 사용:
//   - 서버 전용 ADMIN_EMAILS (서버 액션 권한 검증 — 진실 원천)
//   - 공개 NEXT_PUBLIC_ADMIN_EMAILS (클라이언트의 UI 노출용 — 이메일은 비밀 아님)
// 둘 다 콤마 분리. 보통 같은 값 둘에 세팅.
function parseEnv(): Set<string> {
  const server = process.env.ADMIN_EMAILS ?? '';
  const pub = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
  return new Set(
    (server + ',' + pub)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
}

// 주어진 이메일이 관리자인지. 빈 값/undefined 면 false.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseEnv();
  return list.has(email.trim().toLowerCase());
}

// 관리자 권한이 필요한 서버 액션에서 사용. 통과 못 하면 throw.
// 호출 측은 createClient() 로 가져온 user.email 만 넘길 것.
export function assertAdmin(email: string | null | undefined): void {
  if (!isAdminEmail(email)) {
    throw new Error('FORBIDDEN: admin only');
  }
}
