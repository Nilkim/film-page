// 외부 이미지 프록시 — 네이버 같은 hotlink 차단 사이트의 이미지를 우리
// 서버 경유로 가져온다. 우리 서버가 referer를 위장해 fetch하면 차단 통과.
//
// 보안:
//   - 도메인 화이트리스트(네이버 계열 등)만 허용 → SSRF 방지
//   - Content-Type이 image/* 인지 확인 → HTML 요청 차단
//   - 응답 크기 5MB, 타임아웃 8초로 캡
//   - 캐시 헤더로 동일 이미지 반복 요청 시 우리 서버 부담 ↓
//
// Instagram CDN 특수 케이스:
//   scontent-*.cdninstagram.com URL은 짧은 서명 토큰을 포함 → 수시간 후 만료.
//   DB에 저장된 og_image URL이 죽으므로, `?fallback=<게시글 원본 URL>`을 받아
//   403/410 시 OG 메타를 재추출해 새 서명 URL로 재시도한다.
//
// 캐시 주의 (favicon route와 동일 버그):
//   응답을 `public`으로 두면 Netlify 엣지가 ?url 쿼리를 무시하고 경로만으로
//   캐싱해 모든 카드의 썸네일이 첫 응답 한 장으로 통일되는 버그가 있다.
//   → force-dynamic으로 매 요청 함수를 실행하고, 캐시는 `private`(브라우저 전용)로
//   둬 전체 URL 단위로만 캐시한다.

import { NextResponse, type NextRequest } from 'next/server';
import { fetchOgMeta } from '@/lib/og';

// 매 요청 함수 실행 — Next 라우트 캐시/엣지 경로 캐시에 갇히지 않도록.
export const dynamic = 'force-dynamic';

const ALLOWED_HOST_SUFFIXES = [
  // 네이버 이미지 호스트들
  'pstatic.net',
  'naver.com',
  // 티스토리
  'daumcdn.net',
  'kakaocdn.net',
  // Instagram / Facebook CDN — og:image가 scontent-*.cdninstagram.com 등을 가리킴.
  // 외부 도메인 referer로 직접 fetch하면 차단되거나 짧은 토큰 만료로 403.
  'cdninstagram.com',
  'fbcdn.net',
  // 일반적으로 hotlink 안 막는 곳 (있어도 무방)
  'imgur.com',
  'github.com',
  'githubusercontent.com',
];

// fallback URL 화이트리스트 — OG 재추출은 신뢰 가능한 출처에서만.
const ALLOWED_FALLBACK_HOST_SUFFIXES = [
  'instagram.com',
];

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

const REFERER_FOR = (h: string): string | null => {
  if (h.endsWith('pstatic.net') || h.endsWith('naver.com')) return 'https://m.blog.naver.com/';
  if (h.endsWith('daumcdn.net') || h.endsWith('kakaocdn.net')) return 'https://tistory.com/';
  // Instagram CDN은 referer가 instagram.com 계열일 때 통과율이 높다.
  if (h.endsWith('cdninstagram.com') || h.endsWith('fbcdn.net')) return 'https://www.instagram.com/';
  return null;
};

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  const fallback = req.nextUrl.searchParams.get('fallback');
  if (!raw) return new NextResponse('url required', { status: 400 });

  const parsed = parseAndValidate(raw);
  if (!parsed.ok) return new NextResponse(parsed.error, { status: parsed.status });

  // 1차: 원본 URL로 시도.
  const first = await fetchImage(parsed.target);
  if (first.kind === 'ok') return imageResponse(first.body, first.contentType);

  // 2차: 403/410 이고 fallback URL이 있으면 OG 메타 재추출 후 재시도.
  // Instagram CDN의 서명 토큰 만료를 자동 복구하는 경로.
  if ((first.upstreamStatus === 403 || first.upstreamStatus === 410) && fallback) {
    const fresh = await refetchViaOg(fallback);
    if (fresh) {
      const second = await fetchImage(fresh);
      if (second.kind === 'ok') return imageResponse(second.body, second.contentType);
    }
  }

  return new NextResponse(first.message, { status: first.status });
}

type Parsed =
  | { ok: false; error: string; status: number }
  | { ok: true; target: URL };

function parseAndValidate(raw: string): Parsed {
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return { ok: false, error: 'invalid url', status: 400 };
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return { ok: false, error: 'unsupported protocol', status: 400 };
  }
  const host = target.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) return { ok: false, error: 'host not allowed', status: 403 };
  return { ok: true, target };
}

type FetchResult =
  | { kind: 'ok'; body: ArrayBuffer; contentType: string }
  | { kind: 'err'; status: number; upstreamStatus?: number; message: string };

async function fetchImage(target: URL): Promise<FetchResult> {
  const host = target.hostname.toLowerCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      accept: 'image/*,*/*;q=0.8',
    };
    const referer = REFERER_FOR(host);
    if (referer) headers['referer'] = referer;

    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });

    if (!upstream.ok) {
      console.warn(`[image-proxy] upstream ${upstream.status} for ${host} (${target.pathname})`);
      return {
        kind: 'err',
        status: 502,
        upstreamStatus: upstream.status,
        message: `upstream ${upstream.status}`,
      };
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      console.warn(`[image-proxy] non-image content-type "${contentType}" for ${host}`);
      return { kind: 'err', status: 415, message: 'not an image' };
    }

    const len = upstream.headers.get('content-length');
    if (len && Number(len) > MAX_BYTES) {
      return { kind: 'err', status: 413, message: 'too large' };
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return { kind: 'err', status: 413, message: 'too large' };
    }
    return { kind: 'ok', body, contentType };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return { kind: 'err', status: 502, message: msg };
  } finally {
    clearTimeout(timer);
  }
}

// fallback URL의 OG 메타를 재추출 → 새 og:image URL 반환.
// 화이트리스트(instagram.com) + 이미지 호스트 화이트리스트 둘 다 통과해야 함.
async function refetchViaOg(fallbackRaw: string): Promise<URL | null> {
  let fb: URL;
  try {
    fb = new URL(fallbackRaw);
  } catch {
    return null;
  }
  if (fb.protocol !== 'https:') return null;
  const fbHost = fb.hostname.toLowerCase();
  const fbAllowed = ALLOWED_FALLBACK_HOST_SUFFIXES.some(
    (suffix) => fbHost === suffix || fbHost.endsWith(`.${suffix}`),
  );
  if (!fbAllowed) return null;

  try {
    const og = await fetchOgMeta(fb.toString());
    if (!og.image) return null;
    const fresh = new URL(og.image);
    const freshHost = fresh.hostname.toLowerCase();
    const freshAllowed = ALLOWED_HOST_SUFFIXES.some(
      (suffix) => freshHost === suffix || freshHost.endsWith(`.${suffix}`),
    );
    if (!freshAllowed) return null;
    return fresh;
  } catch {
    return null;
  }
}

function imageResponse(body: ArrayBuffer, contentType: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      // nosniff — 브라우저가 content-type만 믿게 해서 ORB로 차단되는 거 방지.
      'x-content-type-options': 'nosniff',
      // private — 공유(CDN) 캐시 금지(경로-키 충돌 회피). 브라우저는 전체 URL로
      // 키잉하므로 ?url별로 안전하게 1일 캐시.
      'cache-control': 'private, max-age=86400',
    },
  });
}
