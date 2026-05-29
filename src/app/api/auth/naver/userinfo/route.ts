// 네이버 userinfo 평탄화 프록시 — Supabase Custom OAuth2 Provider 전용.
//
// 왜 필요한가:
//   Supabase(GoTrue)의 커스텀 OAuth2 프로바이더는 userinfo 응답의 *최상위* 키에서만
//   sub/email/name 을 읽는다. attribute_mapping 도 "최상위 ↔ 최상위" rename 만 지원하고
//   중첩 경로(JSONPath)는 지원하지 않는다. (supabase/auth internal/api/provider/custom_oauth.go
//   의 applyAttributeMapping 은 claimsMap[sourceKey] 단일 조회만 수행 — 검증 완료.)
//
//   그런데 네이버 /v1/nid/me 응답은 한 겹 감싼 형태다:
//     { "resultcode": "00", "message": "success", "response": { "id", "email", "name", ... } }
//   그대로면 claims.Subject / claims.Email 이 전부 비어 콜백에서 사용자 식별이 깨진다(과거 2회 실패 원인).
//
// 해결:
//   Supabase 프로바이더의 userinfo_url 을 네이버가 아니라 *이 프록시*로 지정한다.
//   authorize/token 은 표준 OAuth2 라 네이버로 직접 가도 되고, 비표준인 userinfo 만 여기서 평탄화한다.
//   흐름: Supabase --(Naver access_token, Bearer)--> 이 프록시 --(그 토큰 그대로)--> 네이버 /nid/me
//         → response.* 를 최상위로 펼쳐 표준 형태 { sub, email, name, ... } 로 반환.
//
// 보안/캐시 주의:
//   응답이 Authorization 헤더(=사용자별 토큰)에 따라 달라지므로 *절대 캐시 금지*.
//   Netlify 엣지가 path-only 로 캐싱하면 A 사용자 프로필이 B 에게 새어나간다.
//   → force-dynamic + Cache-Control: no-store, private (image-proxy 트랩과 동일 처방).

import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NAVER_ME = 'https://openapi.naver.com/v1/nid/me';

// 캐시 절대 금지 헤더 — 사용자별 응답이라 공유 캐시에 걸리면 정보 유출.
const NO_STORE = {
  'Cache-Control': 'no-store, private, max-age=0, must-revalidate',
} as const;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return NextResponse.json(
      { error: 'missing_bearer_token' },
      { status: 401, headers: NO_STORE },
    );
  }

  // 받은 네이버 access token 을 그대로 네이버 프로필 API 로 전달.
  let naverRes: Response;
  try {
    naverRes = await fetch(NAVER_ME, {
      headers: { Authorization: auth },
      // 토큰별 응답이라 fetch 캐시도 끔.
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'naver_unreachable' },
      { status: 502, headers: NO_STORE },
    );
  }

  if (!naverRes.ok) {
    return NextResponse.json(
      { error: 'naver_userinfo_failed', status: naverRes.status },
      { status: 502, headers: NO_STORE },
    );
  }

  const body = (await naverRes.json()) as {
    resultcode?: string;
    message?: string;
    response?: Record<string, unknown>;
  };

  // 네이버는 성공 시 resultcode "00". response 가 실제 프로필.
  const r = body.response;
  if (body.resultcode !== '00' || !r || typeof r !== 'object') {
    return NextResponse.json(
      { error: 'naver_bad_payload', resultcode: body.resultcode ?? null },
      { status: 502, headers: NO_STORE },
    );
  }

  const id = typeof r.id === 'string' ? r.id : undefined;
  if (!id) {
    // sub 가 없으면 Supabase 가 identity 를 만들 수 없다 — 명시적으로 실패시킨다.
    return NextResponse.json(
      { error: 'naver_missing_id' },
      { status: 502, headers: NO_STORE },
    );
  }

  const email = typeof r.email === 'string' ? r.email : undefined;

  // response.* 를 표준 OIDC 스타일 최상위 클레임으로 평탄화.
  // (GoTrue Claims 구조체가 인식하는 키: sub, email, email_verified, name, picture …)
  const flattened: Record<string, unknown> = {
    sub: id,
    name:
      (typeof r.name === 'string' && r.name) ||
      (typeof r.nickname === 'string' && r.nickname) ||
      undefined,
    nickname: typeof r.nickname === 'string' ? r.nickname : undefined,
    picture: typeof r.profile_image === 'string' ? r.profile_image : undefined,
  };

  if (email) {
    flattened.email = email;
    // 네이버는 verified 플래그를 주지 않지만, 네이버 계정 이메일은 네이버가 검증한 값이다.
    flattened.email_verified = true;
  }

  return NextResponse.json(flattened, { headers: NO_STORE });
}
