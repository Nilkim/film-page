// 게시글 카드 한 장. 클릭 시 /posts/[id] 상세로 이동.
//
// 본인 글이면 우상단에 수정/삭제 아이콘이 떠 있음. <a> 안에 <a>/<button> 중첩이
// HTML invalid라 카드 본문(<Link>)과 액션 div를 sibling으로 배치한다.
//
// Layout: 카드 자체는 자유 높이, 썸네일 div만 aspect-[4/3] 비율 고정.
// (카드 전체에 aspect 비율을 걸면 좁은 그리드 셀에서 제목 칸이 압축돼 사라짐)
import Link from 'next/link';
import type { Post } from '@/lib/db';
import { POST_TYPE } from '@/lib/db';
import { proxyIfNeeded } from '@/lib/imageProxy';
import PostCardActions from './PostCardActions';

export default function PostCard({
  post,
  currentUserId,
  likeCount = 0,
  commentCount = 0,
}: {
  post: Post;
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
  const title = post.title || post.og_title || '(제목 없음)';
  const isLink = post.post_type === POST_TYPE.LINK;
  const isOwner = !!currentUserId && currentUserId === post.user_id;

  return (
    <div className="relative">
      <Link
        href={`/posts/${post.id}`}
        className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
      >
        {/* 썸네일 컨테이너:
            - aspect-[4/3]로 비율 고정
            - overflow-hidden: 자식이 박스를 벗어나도 가림
            - 자식 img는 absolute로 → 부모 height에 영향 X (img의 intrinsic 크기가
              부모를 늘리는 순환 문제 차단) */}
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
              no image
            </div>
          )}
          {isLink && post.source_platform && (
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {post.source_platform}
            </span>
          )}
        </div>
        <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-900">
          <div className="line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {title}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[10px] tracking-wide text-zinc-500 dark:text-zinc-400">
              {post.package_code || (post.order_code ? `주문 ${post.order_code}` : '')}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-0.5" aria-label={`좋아요 ${likeCount}`}>
                <HeartIcon />
                {likeCount}
              </span>
              <span className="inline-flex items-center gap-0.5" aria-label={`댓글 ${commentCount}`}>
                <CommentIcon />
                {commentCount}
              </span>
            </span>
          </div>
        </div>
      </Link>

      {/* 본인 글에만 표시. sibling 배치라 카드 Link 클릭과 충돌 없음. */}
      {isOwner && <PostCardActions postId={post.id} />}
    </div>
  );
}

function HeartIcon() {
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
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
