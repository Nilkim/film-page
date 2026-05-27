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
import PriceTag from './PriceTag';
import AddToCartButton from './AddToCartButton';

// 핸드오프 모션 easing — transform 계열에 공통 적용.
const EASE = '[transition-timing-function:cubic-bezier(.2,.7,.2,1)]';

export default function PostCard({
  post,
  index,
  currentUserId,
  likeCount = 0,
  commentCount = 0,
  displayPrice = 0,
  originalPrice = 0,
  hasDiscount = false,
}: {
  post: Post;
  index?: number;
  currentUserId?: string | null;
  likeCount?: number;
  commentCount?: number;
  displayPrice?: number;
  originalPrice?: number;
  hasDiscount?: boolean;
}) {
  // 카드 썸네일 우선순위: 사용자 직접 업로드(cover_image) → 외부 글 OG 이미지
  // (사용자가 폼 미리보기로 본 후 등록한 작품 식별 이미지) → image_urls 폴백.
  // 인스타 CDN 처럼 서명 토큰 만료 시 image-proxy 가 external_url 의 OG 재추출.
  const thumb =
    post.cover_image
    ?? proxyIfNeeded(post.og_image, post.external_url)
    ?? proxyIfNeeded(post.image_urls?.[0])
    ?? null;
  const title = decodeEntities(post.title) || '(제목 없음)';
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
            <span className="text-[10px] font-bold tabular-nums tracking-[0.08em] text-ink-70">
              {idx}
            </span>
          )}
          {/* min-h-[2.8em]: 제목이 1줄이어도 2줄 높이를 예약 → 같은 행 카드 높이 통일 */}
          <span className="line-clamp-2 min-h-[2.8em] text-[13px] font-semibold leading-[1.4] text-ink text-pretty">
            {title}
          </span>
        </div>

        {/* 메타: 좌측 식별자, 우측 좋아요·댓글 통계.
            같은 OG 썸네일을 다른 사용자가 공유하는 경우(블로그/SNS reference)에도
            카드별 식별이 즉시 되도록 label(package_code) 가독성을 본문 수준으로 끌어올림. */}
        <div className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-1.5 text-[10.5px] text-ink-45">
          <span className="truncate font-medium text-ink-70">{label}</span>
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

        {/* 가격 행 — 포트원 '상품 등록 유무' 충족을 위한 노출. 없으면(가격 0) 자리 비움. */}
        {displayPrice > 0 && (
          <div className="px-3 pb-2.5">
            <PriceTag
              displayPrice={displayPrice}
              originalPrice={originalPrice || displayPrice}
              hasDiscount={hasDiscount}
              size="sm"
            />
          </div>
        )}
      </Link>

      {/* 카트 담기 — 카드 외부에 sibling 배치(중첩 anchor 회피).
          가격이 있어야만 노출. 우하단 absolute 가 아니라 카드 아래 행으로 자연 배치. */}
      {displayPrice > 0 && (
        <div className="mt-1 flex justify-end">
          <AddToCartButton
            packageCode={post.package_code}
            postId={post.id}
            title={title}
            thumb={thumb}
            price={displayPrice}
            originalPrice={originalPrice || displayPrice}
            size="sm"
          />
        </div>
      )}

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
