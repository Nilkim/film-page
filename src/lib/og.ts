// OpenGraph 메타 추출 — 서버 전용. 외부 페이지 HTML을 fetch한 뒤
// <meta property="og:*"> 또는 <title>을 정규식으로 뽑는다.
//
// 가벼움을 우선해 cheerio/parse5 같은 파서 의존성은 안 쓴다.
// OG 메타는 <head> 안에 단순한 형태로만 들어가므로 정규식으로 충분.

import { normalizeForFetch } from './extract';
import { decodeEntities } from './htmlEntities';

const FETCH_TIMEOUT_MS = 5_000;
// YouTube 같이 <head>가 매우 큰 사이트(인라인 CSS/JSON-LD 다수)도 커버하려면
// 200KB로는 OG 메타가 잘릴 수 있어 500KB로 늘림. 메모리 부담은 미미.
const MAX_BYTES = 500_000;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

export type OgMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
};

export async function fetchOgMeta(rawUrl: string): Promise<OgMeta> {
  // URL 검증 — http/https만 허용 (file:// 등 차단).
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }

  // YouTube는 클라이언트 JS로 메타를 lazy load해서 SSR HTML에는 실제 영상
  // 제목이 없다. 공식 oEmbed 엔드포인트를 먼저 시도 — title/author/thumbnail
  // 모두 인증 토큰 없이 JSON으로 받음. 실패 시 일반 OG 파싱으로 폴백.
  if (YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    const yt = await fetchYoutubeOembed(rawUrl);
    if (yt && yt.title) return yt;
  }

  // 네이버 블로그는 메인 URL이 iframe wrapper라 OG가 generic("네이버 블로그").
  // 모바일 PostView URL로 정규화해야 실제 글 제목이 들어있는 메타를 받음.
  // extract.ts와 동일한 규칙 재사용.
  const fetchUrl = normalizeForFetch(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    // 봇 UA를 쓰면 YouTube/Instagram 등 일부 사이트가 빈 HTML이나 challenge를
    // 돌려보내 OG 메타를 못 가져옴. 모바일 Safari UA로 보내면 일반 페이지 응답
    // (사이트 측에서 봇 차별 안 함). extract.ts와 동일한 UA로 통일.
    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      // cache: 'no-store' — signal 만으로도 Next 데이터 캐시 회피되지만 명시 안전망.
      // 같은 외부 URL이라도 매번 fresh fetch 보장 → stale OG가 새 글에 박히는 일 차단.
      cache: 'no-store',
      headers: {
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ko,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) {
      html = await res.text();
    } else {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      try { await reader.cancel(); } catch { /* noop */ }
      const buf = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        buf.set(c, offset);
        offset += c.byteLength;
      }
      html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    }
  } finally {
    clearTimeout(timer);
  }

  return parseOgMeta(html);
}

// HTML 문자열에서 OG 메타 + <title>/본문 첫 이미지 폴백을 뽑는다.
export function parseOgMeta(html: string): OgMeta {
  // <head>만 잘라서 검색 (성능 + 본문 노이즈 회피).
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headScope = headMatch ? headMatch[1] : html.slice(0, 50_000);

  const ogTitle = extractMeta(headScope, 'og:title') ?? extractTitle(headScope);
  const ogDesc = extractMeta(headScope, 'og:description') ?? extractMeta(headScope, 'description');
  // og:image가 비거나 없으면 본문에서 첫 valid 이미지로 폴백.
  // 네이버 블로그처럼 lazy-load placeholder src를 쓰는 경우 data-lazy-src 우선.
  const ogImage = extractMeta(headScope, 'og:image') || findFirstBodyImage(html);

  return {
    title: ogTitle?.trim() || null,
    description: ogDesc?.trim() || null,
    image: ogImage?.trim() || null,
  };
}

// 본문 HTML에서 첫 의미있는 이미지 URL을 찾는다.
// 우선순위: data-lazy-src / data-src / data-original > src.
// 명백한 placeholder(투명 gif, base64 data URI, 16px 미만 아이콘)는 제외.
function findFirstBodyImage(html: string): string | null {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const scope = bodyMatch ? bodyMatch[1] : html;

  const imgRegex = /<img\b([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(scope)) !== null) {
    const attrs = m[1];

    // lazy-load 속성이 있으면 그게 진짜 URL (네이버 블로그 케이스)
    for (const k of ['data-lazy-src', 'data-src', 'data-original', 'data-origin-src']) {
      const lm = attrs.match(new RegExp(`\\s${k}\\s*=\\s*["']([^"']+)["']`, 'i'));
      if (lm && isValidImageUrl(lm[1])) return lm[1];
    }
    // 일반 src
    const sm = attrs.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
    if (sm && isValidImageUrl(sm[1])) return sm[1];
  }
  return null;
}

function isValidImageUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  // 1x1 투명 GIF / 명백한 placeholder 제외
  if (/(?:transparent|spacer|blank|placeholder|1x1)/i.test(u)) return false;
  return true;
}

// property="og:title" 또는 name="description" 형태 모두 지원.
function extractMeta(html: string, key: string): string | null {
  // property 또는 name 어느쪽이든 매칭. 속성 순서가 다를 수 있어 두 패턴 시도.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]) : null;
}

// YouTube 공식 oEmbed로 영상 메타 가져오기. 인증 불필요, JSON 응답.
// 응답 예: { title, author_name, thumbnail_url, ... }
async function fetchYoutubeOembed(rawUrl: string): Promise<OgMeta | null> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title?.trim() || null,
      description: data.author_name ? `채널: ${data.author_name}` : null,
      image: data.thumbnail_url ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

