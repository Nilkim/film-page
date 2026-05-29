// Supabase 커스텀 OAuth 프로바이더 조회/삭제 — Dashboard "Delete" 버그 우회용 일회성 스크립트.
//
// 배경: Dashboard 의 삭제 버튼이 식별자를 이중 인코딩(custom:naver -> custom:custom:naver)
//       해서 서버가 거부함. 여기서는 GoTrue admin 엔드포인트로 "한 번만" 인코딩해 직접 호출한다.
//
// 사용법 (프로젝트 루트에서):
//   node scripts/custom-provider.mjs                 # 등록된 커스텀 프로바이더 목록만 조회 (안전)
//   node scripts/custom-provider.mjs custom:naver    # 해당 식별자 삭제
//   node scripts/custom-provider.mjs create          # 네이버 OAuth2 프로바이더 생성(env 자격증명 사용)
//
// create 가 읽는 env (.env.local 또는 셸):
//   NAVER_LOGIN_CLIENT_ID      (없으면 기본값 사용)
//   NAVER_LOGIN_CLIENT_SECRET  (필수 — 네이버 개발자 콘솔의 Client Secret)
//   NAVER_USERINFO_URL         (없으면 https://film-artwork.com/api/auth/naver/userinfo)
//
// 주의: SUPABASE_SERVICE_ROLE_KEY 를 사용하므로 로컬에서만 실행하고, 키를 노출하지 말 것.

import { readFileSync } from 'node:fs';

// .env.local 직접 파싱 (next 없이 순수 node 실행이므로 자동 로드 안 됨)
function loadEnv() {
  const out = {};
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* .env.local 없으면 process.env 사용 */
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
  process.exit(1);
}

const base = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/custom-providers`;
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const target = process.argv[2];

async function list() {
  const res = await fetch(base, { headers });
  const body = await res.text();
  console.log(`GET ${base}\n→ ${res.status} ${res.statusText}\n${body}\n`);
}

async function remove(id) {
  // GoTrue 는 path 파라미터를 "디코드 전 raw 상태"로 prefix('custom:') 검사한다.
  // 따라서 콜론을 %3A 로 인코딩하면 검증 실패 → 콜론은 그대로 두고 나머지만 인코딩.
  // (콜론은 RFC 3986 상 path segment 에서 합법한 문자라 안전)
  const encoded = encodeURIComponent(id).replace(/%3A/gi, ':');
  const url = `${base}/${encoded}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  const body = await res.text();
  console.log(`DELETE ${url}\n→ ${res.status} ${res.statusText}\n${body}\n`);
}

async function create() {
  const clientId = env.NAVER_LOGIN_CLIENT_ID || 'aZ7WtY8TQaXxBFNsoQ2k';
  const clientSecret = env.NAVER_LOGIN_CLIENT_SECRET;
  const userinfoUrl =
    env.NAVER_USERINFO_URL || 'https://film-artwork.com/api/auth/naver/userinfo';

  if (!clientSecret) {
    console.error(
      'NAVER_LOGIN_CLIENT_SECRET 가 없습니다. .env.local 에 추가하거나 셸에서 export 후 다시 실행하세요.',
    );
    process.exit(1);
  }

  const payload = {
    provider_type: 'oauth2', // 네이버는 OIDC 미지원(공식). 표준 OAuth2 로.
    identifier: 'custom:naver',
    name: 'Naver',
    client_id: clientId,
    client_secret: clientSecret,
    // authorize/token 은 네이버 표준 OAuth2 엔드포인트로 직접.
    authorization_url: 'https://nid.naver.com/oauth2.0/authorize',
    token_url: 'https://nid.naver.com/oauth2.0/token',
    // userinfo 만 우리 평탄화 프록시로 — 네이버의 중첩 response 를 최상위로 펼침.
    userinfo_url: userinfoUrl,
    scopes: [], // 네이버는 scope 미사용.
    pkce_enabled: false, // 네이버 표준 OAuth2 는 PKCE 미지원 → 끔.
    email_optional: true, // 사용자가 이메일 동의 안 해도 가입 허용.
    attribute_mapping: {}, // 프록시가 이미 평탄화하므로 매핑 불필요.
  };

  const res = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  console.log(
    `POST ${base}\n(client_id=${clientId}, userinfo_url=${userinfoUrl})\n→ ${res.status} ${res.statusText}\n${body}\n`,
  );
}

const isCreate = target === 'create';

await list(); // 항상 먼저 현재 상태 보여줌
if (isCreate) {
  console.log('--- "custom:naver" 생성 시도 ---');
  await create();
  console.log('--- 생성 후 상태 ---');
  await list();
} else if (target) {
  console.log(`--- "${target}" 삭제 시도 ---`);
  await remove(target);
  console.log('--- 삭제 후 상태 ---');
  await list();
}
