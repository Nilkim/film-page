// 게시글 카드 한 장. 클릭 시 /posts/[id] 상세로 이동. (FilmArtwork 핸드오프 디자인)
//
// client component — 부모 <Feed>가 client에서 currentUserId를 넘겨주고, 본인 글이면
// 우상단에 수정/삭제 아이콘을 띄운다. (홈 ISR 캐싱을 위해 개인화는 클라이언트에서)
//
// 본인 글이면 우상단에 수정/삭제 아이콘이 떠 있음. <a> 안에 <a>/<button> 중첩이
// HTML invalid라 카드 본문(<Link>)과 액션 div를 sibling으로 배치한다.
//
// Layout: 카드 자체는 자유 높이, 썸네일 div만 aspect-[4/3] 비율 고정.
// hover 시 카드 lift + shadow + border 강조, 썸네일 scale(1.06) (group hover).
'use client';

import Link from 'next/link';
import type { Post } from '@/lib/db';
import { proxyIfNeeded } from '@/lib/imageProxy';
import { decodeEntities } from '@/lib/htmlEntities';
import PostCardActions from './PostCardActions';

// 핸드오프 모션 easing — transform 계열에 공통 적용.
const EASE = '[transition-timing-function:cubic-bezier(.2,.7,.2,1)]';

export default function PostCard({
  post,
  index,
  currentUserId,
  likeCount = 0,
  commentCount = 0,
}: {
  post: Post;
  index?: number;
  currentUserId?: string | null;
  likeCount?: number;
  commentCount?: number;
}) {
  // cover_image는 Supabase Storage URL이라 직접 표시(화이트리스트 미매치).
  // og_image / image_urls는 외부 호스트일 때만 image-proxy 경유 — ORB 차단 회피.
  const thumb =
    post.cover_image
    ?? proxyIfNeeded(post.og_image)
    ?? proxyIfNeeded(post.image_urls?.[0])
    ?? null;
  const title = decodeEntities(post.title || post.og_title) || '(제목 없음)';
  const favicon = faviconUrl(post.external_url);
  const isOwner = !!currentUserId && currentUserId === post.user_id;
  const idx = index != null ? String(index).padStart(2, '0') : null;
  const label = post.package_code || (post.order_code ? `주문 ${post.order_code}` : '');

  return (
    <div className="relative">
      <Link
        href={`/posts/${post.id}`}
        className={`group flex flex-col overflow-hidden rounded-[6px] border border-card-line bg-card transition-[transform,box-shadow,border-color] duration-[350ms] ${EASE} hover:-translate-y-[3px] hover:border-ink-60 hover:shadow-[0_8px_22px_rgba(27,22,16,0.08)]`}
      >
        {/* 썸네일 컨테이너: aspect-[4/3] 비율 고정, group hover 시 내부 이미지 zoom */}
        <div className="relative aspect-[4/3] overflow-hidden bg-ink-06">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[550ms] ${EASE} group-hover:scale-[1.06]`}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-ink-45">
              no image
            </div>
          )}
          {favicon && (
            // 링크 페이지의 파비콘 — 흰 라운드 칩 안에. 미지의 도메인은 구글이
            // 기본 아이콘을 돌려줘 깨질 일이 거의 없음(별도 onError 불필요).
            <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-[5px] border border-card-line bg-card p-1 shadow-[0_1px_3px_rgba(27,22,16,0.12)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={favicon} alt="" className="size-full object-contain" loading="lazy" />
            </span>
          )}
        </div>

        {/* 본문: idx + 제목(2-line clamp) */}
        <div className="flex items-baseline gap-2.5 border-t border-ink-10 px-3 pb-2 pt-2.5">
          {idx && (
            <span className="text-[10px] font-bold tabular-nums tracking-[0.08em] text-ink-45">
              {idx}
            </span>
          )}
          {/* min-h-[2.8em]: 제목이 1줄이어도 2줄 높이를 예약 → 같은 행 카드 높이 통일 */}
          <span className="line-clamp-2 min-h-[2.8em] text-[13px] font-semibold leading-[1.4] text-ink text-pretty">
            {title}
          </span>
        </div>

        {/* 메타: 좌측 식별자, 우측 좋아요·댓글 통계 */}
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1.5 text-[10.5px] text-ink-45">
          <span className="truncate">{label}</span>
          <span className="flex shrink-0 items-center gap-2 tabular-nums">
            <span className="inline-flex items-center gap-1" aria-label={`좋아요 ${likeCount}`}>
              <span aria-hidden="true">♥</span>
              {likeCount}
            </span>
            <span className="inline-flex items-center gap-1" aria-label={`댓글 ${commentCount}`}>
              <CommentIcon />
              {commentCount}
            </span>
          </span>
        </div>
      </Link>

      {/* 본인 글에만 표시. sibling 배치라 카드 Link 클릭과 충돌 없음. */}
      {isOwner && <PostCardActions postId={post.id} />}
    </div>
  );
}

// 외부 링크 파비콘 URL. 자체 프록시(/api/favicon) 경유 — 여러 서비스를 순서대로
// 시도해 네이버블로그/티스토리 등 단일 서비스가 못 잡는 도메인까지 커버한다.
function faviconUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // URL 유효성만 검증 후 프록시에 위임.
    new URL(url);
    return `/api/favicon?url=${encodeURIComponent(url)}`;
  } catch {
    return null;
  }
}

function CommentIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
