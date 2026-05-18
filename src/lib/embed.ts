// 외부 URL을 플랫폼별로 분류하고, 임베드 가능한 경우 iframe용 URL을 만든다.
// 순수 함수 모음 — 외부 의존성 없음, 서버/클라이언트 양쪽에서 호출 가능.

import { SOURCE_PLATFORM, type SourcePlatform } from './db';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

export function detectPlatform(rawUrl: string): SourcePlatform {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return SOURCE_PLATFORM.BLOG;
  }
  if (YOUTUBE_HOSTS.has(host)) return SOURCE_PLATFORM.YOUTUBE;
  if (INSTAGRAM_HOSTS.has(host)) return SOURCE_PLATFORM.INSTAGRAM;
  return SOURCE_PLATFORM.BLOG;
}

// 임베드 iframe에 넣을 수 있는 URL로 변환. 불가하면 null.
export function toEmbedUrl(rawUrl: string, platform: SourcePlatform): string | null {
  if (platform === SOURCE_PLATFORM.YOUTUBE) return youtubeEmbedUrl(rawUrl);
  if (platform === SOURCE_PLATFORM.INSTAGRAM) return instagramEmbedUrl(rawUrl);
  return null;
}

export function isEmbeddable(platform: SourcePlatform | null): boolean {
  return platform === SOURCE_PLATFORM.YOUTUBE || platform === SOURCE_PLATFORM.INSTAGRAM;
}

function youtubeEmbedUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  // youtu.be/<id>
  if (u.hostname.endsWith('youtu.be')) {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  // youtube.com/watch?v=<id>
  const watchId = u.searchParams.get('v');
  if (watchId) return `https://www.youtube.com/embed/${watchId}`;
  // youtube.com/shorts/<id> or /embed/<id>
  const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

function instagramEmbedUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  // /p/<id>/, /reel/<id>/, /tv/<id>/
  const m = u.pathname.match(/^\/(p|reel|tv)\/([^/?#]+)/);
  if (!m) return null;
  return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`;
}
