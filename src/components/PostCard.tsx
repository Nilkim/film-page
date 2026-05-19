// 게시글 카드 한 장. 클릭 시 /posts/[id] 상세로 이동.
//
// 본인 글이면 우상단에 수정/삭제 아이콘이 떠 있음. <a> 안에 <a>/<button> 중첩이
// HTML invalid라 카드 본문(<Link>)과 액션 div를 sibling으로 배치한다.
import Link from 'next/link';
import type { Post } from '@/lib/db';
import { POST_TYPE } from '@/lib/db';
import { proxyIfNeeded } from '@/lib/imageProxy';
import PostCardActions from './PostCardActions';

export default function PostCard({
  post,
  currentUserId,
}: {
  post: Post;
  currentUserId?: string | null;
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
        className="group flex aspect-[4/3] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="relative flex-1 bg-zinc-100 dark:bg-zinc-900">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
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
          <div className="mt-0.5 font-mono text-[10px] tracking-wide text-zinc-500 dark:text-zinc-400">
            {post.package_code || (post.order_code ? `주문 ${post.order_code}` : '')}
          </div>
        </div>
      </Link>

      {/* 본인 글에만 표시. sibling 배치라 카드 Link 클릭과 충돌 없음. */}
      {isOwner && <PostCardActions postId={post.id} />}
    </div>
  );
}
