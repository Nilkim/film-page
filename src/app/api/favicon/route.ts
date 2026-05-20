// 파비콘 프록시 — 외부 링크의 파비콘을 여러 서비스에서 순서대로 시도해 가져온다.
//
// 단일 서비스로는 커버리지가 부족하다(실측):
//   - 구글 s2/favicons: youtube/instagram OK, 네이버블로그/티스토리 404(기본 지구본)
//   - 구글 faviconV2:    tistory OK, naver 404
//   - DuckDuckGo:        naver OK, tistory 404
// → faviconV2 → DuckDuckGo → s2 순으로 첫 성공(200 + 이미지)을 반환.
//
// 서버에서 fetch하므로 CORS 무관. 결과는 길게 캐시해 매 요청 외부 호출을 막는다.
import { type NextRequest } from 'next/server';

const TIMEOUT_MS = 4_000;

// 시도할 파비콘 소스들. full URL과 host를 받아 각 서비스 엔드포인트를 만든다.
function candidates(fullUrl: string, host: string): string[] {
  return [
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(fullUrl)}&size=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?sz=64&domain=${host}`,
  ];
}

async function tryFetch(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    // 200 + 이미지 + 어느 정도 크기(빈/플레이스홀더 회피)만 채택.
    if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
      return res;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  let host = '';
  let fullUrl = '';
  try {
    const u = new URL(target ?? '');
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
    host = u.hostname;
    fullUrl = u.toString();
  } catch {
    return new Response(null, { status: 400 });
  }

  for (const c of candidates(fullUrl, host)) {
    const res = await tryFetch(c);
    if (res) {
      const buf = await res.arrayBuffer();
      // 너무 작으면(깨진/빈 아이콘) 다음 후보로.
      if (buf.byteLength > 100) {
        return new Response(buf, {
          status: 200,
          headers: {
            'content-type': res.headers.get('content-type') ?? 'image/png',
            // 하루 캐시 + stale-while-revalidate. CDN/브라우저 모두 적용.
            'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    }
  }

  // 모든 소스 실패 — 204(No Content). <img>는 alt도 비어있어 조용히 사라짐.
  return new Response(null, { status: 204 });
}
