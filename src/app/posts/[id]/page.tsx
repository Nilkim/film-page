// 게시글 상세 페이지 — post_type에 따라 3가지로 분기 렌더.
//
//   1) text  → 사이트 내부에 직접 작성한 글. 제목 + 본문 + 이미지 렌더.
//   2) link + 임베드 가능 (youtube/instagram) → 사이트 안에 iframe으로 본문 표시.
//   3) link + 임베드 불가 (일반 블로그) → OG 미리보기 + "원본 보기" 버튼.
//
// Next.js 16 규약: params는 Promise — `await params` 해야 한다.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { TABLE, POST_TYPE, SOURCE_PLATFORM, type Post, type OrderPackage } from '@/lib/db';
import { isEmbeddable, toEmbedUrl } from '@/lib/embed';
import { extractArticle, type ExtractedArticle } from '@/lib/extract';
import { findPackageByCode } from '@/lib/orders';
import { proxyIfNeeded } from '@/lib/imageProxy';
import LikeButton from '@/components/LikeButton';
import CommentsSection from '@/components/CommentsSection';

export default async function PostDetailPage(props: PageProps<'/posts/[id]'>) {
  const { id } = await props.params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE.POSTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) notFound();
  const post = data as Post;

  // 현재 사용자 (좋아요 상태 + 댓글 권한 판정용).
  const { data: { user } } = await supabase.auth.getUser();

  // 좋아요 카운트 + 본인 좋아요 여부를 병렬 조회.
  const [{ count: likeCountRaw }, mineRes] = await Promise.all([
    supabase.from(TABLE.LIKES).select('post_id', { count: 'exact', head: true }).eq('post_id', id),
    user
      ? supabase.from(TABLE.LIKES).select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const likeCount = likeCountRaw ?? 0;
  const likedByMe = !!mineRes.data;

  // 주문 패키지 정보 — 헤더에 노출. 없으면(legacy) order_code 단건 표시 폴백.
  const pkg: OrderPackage | null = post.package_code
    ? await findPackageByCode(supabase, post.package_code)
    : null;

  // 블로그 등 임베드 불가 외부 링크는 서버에서 본문 HTML을 직접 추출해서
  // 우리 페이지 안에 인라인 렌더한다. 실패 시 null → OG 카드 폴백.
  let extracted: ExtractedArticle | null = null;
  if (
    post.post_type === POST_TYPE.LINK &&
    post.external_url &&
    post.source_platform === SOURCE_PLATFORM.BLOG
  ) {
    try {
      extracted = await extractArticle(post.external_url);
    } catch {
      extracted = null;
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← 목록으로
        </Link>

        {/* 상단 패키지 강조 영역 — 페이지 진입 시 가장 먼저 보이게. */}
        <PackageHeader post={post} pkg={pkg} />

        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {post.title || post.og_title || '(제목 없음)'}
        </h1>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {new Date(post.created_at).toLocaleDateString('ko-KR')}
        </div>

        {/* 대표 이미지 (있으면 hero로) */}
        {post.cover_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_image}
            alt=""
            className="mt-4 max-h-[480px] w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
          />
        )}

        <div className="mt-6">
          {post.post_type === POST_TYPE.TEXT ? (
            <TextPostBody post={post} />
          ) : (
            <LinkPostBody post={post} extracted={extracted} />
          )}
        </div>

        {/* 좋아요 — 본문 바로 아래, 우측 정렬 */}
        <div className="mt-8 flex justify-end">
          <LikeButton
            postId={post.id}
            initialLiked={likedByMe}
            initialCount={likeCount}
            isLoggedIn={!!user}
          />
        </div>

        {/* 댓글 */}
        <CommentsSection postId={post.id} />
      </main>
    </div>
  );
}

// 상단 패키지 헤더 — "주문 패키지: PKG-XXX" + 묶인 주문번호 목록.
function PackageHeader({ post, pkg }: { post: Post; pkg: OrderPackage | null }) {
  const codes = pkg?.order_codes ?? (post.order_code ? [post.order_code] : []);

  return (
    <div className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-3 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          주문 패키지
        </div>
        {pkg && (
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {codes.length}건 묶음
          </div>
        )}
      </div>
      <div className="mt-0.5 font-mono text-lg font-bold tracking-wide">
        {post.package_code || '—'}
      </div>
      {codes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {codes.map((c) => (
            <span
              key={c}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TextPostBody({ post }: { post: Post }) {
  return (
    <article className="space-y-4">
      {post.image_urls?.length > 0 && (
        <div className="space-y-3">
          {post.image_urls.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={proxyIfNeeded(src) ?? ''}
              alt=""
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
        {post.body}
      </p>
    </article>
  );
}

function LinkPostBody({
  post,
  extracted,
}: {
  post: Post;
  extracted: ExtractedArticle | null;
}) {
  if (!post.external_url) return null;

  const embedUrl = isEmbeddable(post.source_platform)
    ? toEmbedUrl(post.external_url, post.source_platform!)
    : null;

  let origin = '';
  try {
    origin = new URL(post.external_url).hostname;
  } catch { /* noop */ }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-zinc-500 dark:text-zinc-400">
          원본: <span className="font-medium text-zinc-700 dark:text-zinc-300">{origin}</span>
        </span>
        <a
          href={post.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-700 hover:underline dark:text-zinc-300"
        >
          원본 보기 ↗
        </a>
      </div>

      {embedUrl ? (
        // YouTube / Instagram — 공식 임베드 iframe
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-200 bg-black dark:border-zinc-800">
          <iframe
            src={embedUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : extracted ? (
        // 블로그 본문을 서버에서 직접 추출 — 사이트 안에 인라인 렌더
        <ExtractedBody extracted={extracted} />
      ) : (
        // 본문 추출도 실패 — OG 카드 폴백
        <a
          href={post.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          {post.og_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxyIfNeeded(post.og_image) ?? ''} alt="" className="aspect-video w-full object-cover" />
          )}
          <div className="p-4">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {post.og_title ?? post.external_url}
            </div>
            {post.og_description && (
              <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                {post.og_description}
              </p>
            )}
            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
              본문을 가져오지 못했어요. 원본 페이지에서 확인해 주세요.
            </div>
          </div>
        </a>
      )}

      {post.body && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {post.body}
        </p>
      )}
    </div>
  );
}

// 외부 블로그에서 추출한 본문 HTML을 우리 페이지 안에 직접 렌더.
//
// sanitize는 lib/extract.ts에서 끝났지만, 다음 안전장치를 추가로 둔다:
//   - 컨테이너에 referrerPolicy 무관 — 대신 prose 스타일과 이미지 width 제한
//   - 외부 링크는 모두 새 탭으로 (rel=noopener) — 본문 내부 anchor에는
//     적용하지 않고, 사용자가 클릭 시 브라우저 기본 동작에 맡김(본문 그대로 유지).
function ExtractedBody({ extracted }: { extracted: ExtractedArticle }) {
  return (
    <article
      className="extracted-body max-w-none rounded-lg border border-zinc-200 bg-white p-6 text-base leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded [&_p]:my-3 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic dark:[&_blockquote]:border-zinc-700 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-sm dark:[&_pre]:bg-zinc-900 [&_table]:my-3 [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-300 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-zinc-300 [&_td]:px-2 [&_td]:py-1 dark:[&_th]:border-zinc-700 dark:[&_td]:border-zinc-700"
      dangerouslySetInnerHTML={{ __html: extracted.html }}
    />
  );
}
