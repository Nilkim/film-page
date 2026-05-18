// 외부 이미지 프록시 — 네이버 같은 hotlink 차단 사이트의 이미지를 우리
// 서버 경유로 가져온다. 우리 서버가 referer 없이 fetch하면 차단 통과.
//
// 보안:
//   - 도메인 화이트리스트(네이버 계열 등)만 허용 → SSRF 방지
//   - Content-Type이 image/* 인지 확인 → HTML 요청 차단
//   - 응답 크기 5MB, 타임아웃 8초로 캡
//   - 캐시 헤더로 동일 이미지 반복 요청 시 우리 서버 부담 ↓

import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_HOST_SUFFIXES = [
  // 네이버 이미지 호스트들
  'pstatic.net',
  'naver.com',
  // 티스토리
  'daumcdn.net',
  'kakaocdn.net',
  // 일반적으로 hotlink 안 막는 곳 (있어도 무방)
  'imgur.com',
  'github.com',
  'githubusercontent.com',
];

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('url required', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('invalid url', { status: 400 });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return new NextResponse('unsupported protocol', { status: 400 });
  }

  // SSRF 방지: 화이트리스트된 도메인의 서브도메인만 허용.
  const host = target.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    return new NextResponse('host not allowed', { status: 403 });
  }

  // 호스트별로 적절한 referer를 위장 — 네이버/티스토리는 본인 도메인에서 온
  // 것처럼 보여야 hotlink 검증을 통과한다.
  const refererFor = (h: string): string | null => {
    if (h.endsWith('pstatic.net') || h.endsWith('naver.com')) return 'https://m.blog.naver.com/';
    if (h.endsWith('daumcdn.net') || h.endsWith('kakaocdn.net')) return 'https://tistory.com/';
    return null;
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      accept: 'image/*,*/*;q=0.8',
    };
    const referer = refererFor(host);
    if (referer) headers['referer'] = referer;

    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });

    if (!upstream.ok) {
      console.warn(`[image-proxy] upstream ${upstream.status} for ${host} (${target.pathname})`);
      return new NextResponse(`upstream ${upstream.status}`, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      console.warn(`[image-proxy] non-image content-type "${contentType}" for ${host}`);
      return new NextResponse('not an image', { status: 415 });
    }

    // 크기 캡 — 매우 큰 파일은 거부 (악용/DoS 방지).
    const len = upstream.headers.get('content-length');
    if (len && Number(len) > MAX_BYTES) {
      return new NextResponse('too large', { status: 413 });
    }

    // 본문을 그대로 전달. 캐시 헤더로 브라우저/엣지 캐싱.
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return new NextResponse('too large', { status: 413 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': contentType,
        // nosniff — 브라우저가 content-type만 믿게 해서 ORB로 차단되는 거 방지.
        'x-content-type-options': 'nosniff',
        // CORP — 어떤 cross-origin embedding에도 명시적 허락. 일부 브라우저의
        // 엄격한 ORB 정책에서 추가 보호막 역할.
        'cross-origin-resource-policy': 'cross-origin',
        // 1일 캐시 — 같은 이미지 반복 요청 시 우리 서버 안 거치게.
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return new NextResponse(msg, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
