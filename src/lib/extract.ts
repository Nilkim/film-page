// 외부 블로그 본문 HTML 추출 — 서버 전용.
//
// iframe 임베드가 막힌 사이트(네이버 블로그 등)를 위해, 서버에서 페이지를
// fetch해서 본문 영역만 추출 → 우리 페이지에 인라인 렌더한다.
//
// 흐름:
//   1. URL 정규화 (네이버는 모바일 PostView URL로 우회)
//   2. fetch (timeout, size cap)
//   3. 플랫폼별 본문 셀렉터로 잘라내기
//   4. sanitize — script/style/이벤트 핸들러 제거 (XSS 방지)
//
// 주의: 외부 사이트 구조가 바뀌면 추출이 깨질 수 있다. 그래서 항상 실패를
// 정상 경로로 처리해야 한다 — 호출 측에서 null이면 OG 카드 폴백.

import { shouldProxy, toProxyUrl } from './imageProxy';

const FETCH_TIMEOUT_MS = 6_000;
const MAX_BYTES = 1_500_000; // 1.5MB — 본문 + 이미지 태그 다수 포함 가능

export type ExtractedArticle = {
  html: string;          // sanitize된 본문 HTML
  textPreview: string;   // 본문에서 추출한 텍스트 미리보기 (검색/요약용, 200자)
  imageCount: number;
};

export async function extractArticle(rawUrl: string): Promise<ExtractedArticle | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const fetchUrl = normalizeForFetch(url);
  const html = await fetchHtml(fetchUrl);
  if (!html) return null;

  const body = pickBody(url, html);
  if (!body) return null;

  const sanitized = sanitize(body);
  if (!sanitized.trim()) return null;
  const safe = postProcessImages(sanitized);

  const text = stripTags(safe).replace(/\s+/g, ' ').trim();
  const imageCount = (safe.match(/<img\b/gi) ?? []).length;

  return {
    html: safe,
    textPreview: text.slice(0, 200),
    imageCount,
  };
}

// 네이버 블로그처럼 본문이 iframe 안에 있는 경우, 본문이 실제로 로드되는
// URL로 바꿔준다. OG 메타 추출(og.ts)도 같은 변환이 필요해 export.
export function normalizeForFetch(url: URL): string {
  const host = url.hostname.toLowerCase();

  if (host === 'blog.naver.com' || host === 'm.blog.naver.com') {
    // 패턴 1: blog.naver.com/{blogId}/{logNo}
    const m = url.pathname.match(/^\/([^/]+)\/(\d+)/);
    if (m) {
      return `https://m.blog.naver.com/PostView.naver?blogId=${m[1]}&logNo=${m[2]}`;
    }
    // 패턴 2: 이미 PostView 형태
    if (url.pathname.startsWith('/PostView')) {
      // 호스트만 모바일로 맞춰서 본문 노출 보장
      return `https://m.blog.naver.com${url.pathname}${url.search}`;
    }
  }

  // 티스토리, 일반 블로그는 그대로
  return url.toString();
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 모바일 브라우저로 보이게 — 일부 사이트가 봇을 차단해서.
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ko,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return await res.text();

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
    // 네이버는 UTF-8을 잘 안내림. <meta charset=...>은 거의 utf-8이라 가정.
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 호스트별 본문 셀렉터. 매치되는 첫 번째 컨테이너 안의 innerHTML을 반환.
function pickBody(originalUrl: URL, html: string): string | null {
  const host = originalUrl.hostname.toLowerCase();

  if (host.endsWith('blog.naver.com')) {
    return (
      // 스마트에디터 ONE (최신)
      pickByClass(html, 'se-main-container') ||
      // 구 에디터
      pickById(html, 'postViewArea') ||
      pickByClass(html, 'post_ct')
    );
  }
  if (host.endsWith('tistory.com')) {
    return (
      pickByClass(html, 'tt_article_useless_p_margin') ||
      pickByClass(html, 'entry-content') ||
      pickByClass(html, 'article-view') ||
      pickByClass(html, 'tt-article')
    );
  }
  if (host.endsWith('brunch.co.kr')) {
    return pickByClass(html, 'wrap_body');
  }

  // 일반 사이트 폴백 — <article> 또는 의미 있는 본문 컨테이너
  return (
    pickTag(html, 'article') ||
    pickByClass(html, 'post-content') ||
    pickByClass(html, 'entry-content') ||
    pickById(html, 'content') ||
    pickTag(html, 'main')
  );
}

// HTML에서 class={name}을 가진 첫 번째 요소의 innerHTML을 잘라낸다.
// 정규식만으론 중첩 태그 카운트가 까다로워, 단순한 균형 스캐너를 쓴다.
function pickByClass(html: string, className: string): string | null {
  const reOpen = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRe(className)}\\b[^"']*["'][^>]*>`,
    'i',
  );
  return sliceByOpenRegex(html, reOpen);
}

function pickById(html: string, idName: string): string | null {
  const reOpen = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\bid\\s*=\\s*["']${escapeRe(idName)}["'][^>]*>`,
    'i',
  );
  return sliceByOpenRegex(html, reOpen);
}

function pickTag(html: string, tag: string): string | null {
  const reOpen = new RegExp(`<(${escapeRe(tag)})\\b[^>]*>`, 'i');
  return sliceByOpenRegex(html, reOpen);
}

// 여는 태그를 정규식으로 찾고, 같은 태그명의 짝맞는 닫는 태그까지 균형스캔.
function sliceByOpenRegex(html: string, reOpen: RegExp): string | null {
  const m = reOpen.exec(html);
  if (!m) return null;
  const tagName = m[1].toLowerCase();
  const start = m.index + m[0].length;

  const reOpenAny = new RegExp(`<${escapeRe(tagName)}\\b[^>]*>`, 'gi');
  const reClose = new RegExp(`<\\/${escapeRe(tagName)}\\s*>`, 'gi');
  reOpenAny.lastIndex = start;
  reClose.lastIndex = start;

  let depth = 1;
  let cursor = start;
  while (depth > 0) {
    reOpenAny.lastIndex = cursor;
    reClose.lastIndex = cursor;
    const openMatch = reOpenAny.exec(html);
    const closeMatch = reClose.exec(html);
    if (!closeMatch) return null;
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      cursor = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      if (depth === 0) {
        return html.slice(start, closeMatch.index);
      }
      cursor = closeMatch.index + closeMatch[0].length;
    }
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// HTML sanitizer — 외부 라이브러리 없이 정규식 기반.
//
// 화이트리스트 방식이 더 안전하지만 본문 형식이 너무 다양해 블랙리스트로
// 위험 요소만 제거하는 실용적인 접근을 쓴다.
// 제거 대상:
//   - <script>, <style>, <iframe>, <object>, <embed>, <link>, <meta>
//   - on*=... 인라인 이벤트 핸들러
//   - javascript: / data:text/html URL
function sanitize(html: string): string {
  let s = html;

  // 위험 태그 전체 (내용 포함) 제거
  s = s.replace(/<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi, '');
  // 자가 닫는 위험 태그
  s = s.replace(/<(link|meta|base)\b[^>]*\/?>/gi, '');

  // 인라인 이벤트 핸들러 (on... = "...")  — 따옴표/홑따옴표/없음 모두 처리
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  // javascript:, vbscript:, data: URL — href/src 등 모든 속성에서
  s = s.replace(/\s(href|src|xlink:href)\s*=\s*"\s*(javascript|vbscript|data):[^"]*"/gi, ' $1="#"');
  s = s.replace(/\s(href|src|xlink:href)\s*=\s*'\s*(javascript|vbscript|data):[^']*'/gi, " $1='#'");

  return s;
}

// 추출한 HTML에서 텍스트만 — 미리보기/검색용
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

// 추출한 본문의 <img> 태그를 정상적으로 보이도록 후처리.
//
//   1. lazy-load 속성(data-lazy-src, data-src, data-original)을 src로 승격
//   2. 네이버 이미지 URL의 작은 변환(?type=w80_blur 등)을 큰 변환으로 교체
//   3. 네이버/티스토리 등 hotlink 차단 사이트의 이미지는 /api/image-proxy 경유
//   4. inline width/height 속성 제거 (CSS로 반응형 처리)
//   5. style 속성 안의 width/height 제거
//   6. referrerpolicy="no-referrer" 추가 — hotlink 차단 회피 (프록시 폴백)
//   7. loading="lazy" 추가 — 본문 긴 글의 첫 페인트 가속

// 본문 <img> 후처리 — lazy-load 승격, 네이버 작은 변환 → w966, image-proxy rewrite,
// inline 크기 제거, referrerpolicy/loading 보강.
function postProcessImages(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (_full, attrsRaw: string) => {
    let attrs = attrsRaw;

    // 1. lazy-load 속성에서 진짜 src 찾기 — 우선순위 순서
    const lazyKeys = ['data-lazy-src', 'data-src', 'data-original', 'data-origin-src', 'data-original-src'];
    let realSrc: string | null = null;
    for (const k of lazyKeys) {
      const m = attrs.match(new RegExp(`\\s${k}\\s*=\\s*["']([^"']+)["']`, 'i'));
      if (m && m[1]) {
        realSrc = m[1];
        break;
      }
    }

    if (realSrc) {
      if (/\ssrc\s*=/i.test(attrs)) {
        attrs = attrs.replace(/\ssrc\s*=\s*["'][^"']*["']/i, ` src="${realSrc}"`);
      } else {
        attrs = ` src="${realSrc}"` + attrs;
      }
    }

    // 2. 네이버 이미지 — 작은 변환을 큰 변환으로 교체.
    attrs = attrs.replace(/(\b(?:blogfiles|postfiles|mblogthumb-phinf)\.pstatic\.net\/[^"'\s?]+\?[^"'\s]*?type=)w\d+(?:_blur)?/gi, '$1w966');

    // 3. hotlink 차단 호스트는 src를 image-proxy 경로로 rewrite.
    attrs = attrs.replace(/\ssrc\s*=\s*["']([^"']+)["']/i, (_m, srcUrl: string) => {
      if (shouldProxy(srcUrl)) {
        return ` src="${toProxyUrl(srcUrl)}"`;
      }
      return ` src="${srcUrl}"`;
    });

    // 4. inline width/height 속성 제거
    attrs = attrs.replace(/\swidth\s*=\s*["']?[^"'\s>]+["']?/gi, '');
    attrs = attrs.replace(/\sheight\s*=\s*["']?[^"'\s>]+["']?/gi, '');

    // 5. style 속성에서 width/height 제거 (다른 style은 보존)
    attrs = attrs.replace(/(\sstyle\s*=\s*["'])([^"']*)(["'])/gi, (_m, p1, css: string, p3) => {
      const cleaned = css
        .replace(/(?:^|;)\s*(?:width|height|max-width|max-height|min-width|min-height)\s*:[^;]+/gi, '')
        .replace(/^\s*;+/, '')
        .trim();
      return cleaned ? `${p1}${cleaned}${p3}` : '';
    });

    // 6. referrerpolicy + loading 보강 (프록시 안 거치는 이미지에 대한 폴백)
    if (!/\sreferrerpolicy\s*=/i.test(attrs)) attrs += ' referrerpolicy="no-referrer"';
    if (!/\sloading\s*=/i.test(attrs)) attrs += ' loading="lazy"';

    return `<img${attrs}>`;
  });
}
