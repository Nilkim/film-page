// 외부 이미지 URL을 우리 image-proxy 경유로 전환하는 헬퍼.
//
// 네이버 등 hotlink 차단 사이트의 이미지를 cross-origin으로 직접 fetch하면
// 브라우저가 ERR_BLOCKED_BY_ORB로 차단한다. 화이트리스트된 호스트는 우리
// `/api/image-proxy?url=...`로 src를 rewrite해 same-origin 응답으로 받게 한다.
//
// `src/app/api/image-proxy/route.ts`의 ALLOWED_HOST_SUFFIXES와 의미적으로 짝.
// (server-only route와 client-safe lib를 코드 직접 공유하진 않고 의도만 동기화)

const PROXY_HOST_SUFFIXES = [
  // 네이버 — blogfiles, postfiles, mblogthumb-phinf, blogthumb 등 모든 서브도메인
  'pstatic.net',
  'naver.com',
  // 티스토리 / 카카오
  'daumcdn.net',
  'kakaocdn.net',
  // Instagram / Facebook CDN — scontent-*.cdninstagram.com, *.fbcdn.net
  // og:image가 이 CDN을 가리키는데, referer가 외부 도메인이면 차단 또는
  // 토큰 만료로 403이 나기 쉬워 우리 서버 경유로 referer를 위장한다.
  'cdninstagram.com',
  'fbcdn.net',
];

export function shouldProxy(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    return PROXY_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function toProxyUrl(rawUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
}

// null-safe 편의 함수.
//   - 빈 값/null → null
//   - 우리 도메인 또는 화이트리스트 미매치 → 원본 URL 그대로
//   - 화이트리스트 매치 → /api/image-proxy?url=... 형태
export function proxyIfNeeded(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  return shouldProxy(rawUrl) ? toProxyUrl(rawUrl) : rawUrl;
}
