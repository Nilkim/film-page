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
import { createAnonClient } from '@/lib/supabase/anon';
import { TABLE, POST_TYPE, SOURCE_PLATFORM, type Post, type OrderPackage } from '@/lib/db';
import { isEmbeddable, toEmbedUrl } from '@/lib/embed';
import { unstable_cache } from 'next/cache';
import { extractArticle, type ExtractedArticle } from '@/lib/extract';
import { fetchOgMeta, type OgMeta } from '@/lib/og';
import { findPackageByCode, findOrdersByPhone } from '@/lib/orders';
import { proxyIfNeeded } from '@/lib/imageProxy';
import { decodeEntities } from '@/lib/htmlEntities';
import LikeButton from '@/components/LikeButton';
import CommentsSection from '@/components/CommentsSection';
import OrderPackagePanel, { type OrderDetail } from '@/components/OrderPackagePanel';

// ISR: 상세 페이지를 캐시해 매 요청 SSR(콜드 스타트 + 블로그 본문 실시간 fetch)을 피한다.
// 개인화(내 좋아요/로그인/댓글)는 클라이언트에서 처리. 수정/삭제 시 actions가
// revalidatePath로 갱신. 공개 데이터만 읽으므로 쿠키 없는 anon 클라이언트 사용.
export const revalidate = 60;

// 블로그 본문 추출은 외부 fetch(2~4초)라 가장 비싸다. extractArticle의 fetch는
// AbortController signal 때문에 Next 데이터 캐시에 안 잡히므로, 결과를 URL 기준으로
// unstable_cache에 1시간 캐싱한다 — 같은 글을 다시 봐도 다시 긁지 않음.
const getExtractedCached = unstable_cache(
  async (url: string): Promise<ExtractedArticle | null> => {
    try {
      return await extractArticle(url);
    } catch {
      return null;
    }
  },
  ['post-extracted-article'],
  { revalidate: 3600 },
);

export default async function PostDetailPage(props: PageProps<'/posts/[id]'>) {
  const { id } = await props.params;

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from(TABLE.POSTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) notFound();
  const post = data as Post;

  // 좋아요 공개 카운트(초기 표시용). 내 좋아요 여부는 LikeButton이 클라이언트에서 확인.
  const { count: likeCountRaw } = await supabase
    .from(TABLE.LIKES)
    .select('post_id', { count: 'exact', head: true })
    .eq('post_id', id);
  const likeCount = likeCountRaw ?? 0;

  // 주문 패키지 정보 — 헤더에 노출. 없으면(legacy) order_code 단건 표시 폴백.
  const pkg: OrderPackage | null = post.package_code
    ? await findPackageByCode(supabase, post.package_code)
    : null;

  // 묶인 주문 코드 + 각 주문 상세(도형/필름) — 칩 클릭 시 펼쳐 보여줌.
  // 상세는 패키지에 저장된 phone으로 RPC 재조회해 매칭(없으면 코드만 표시).
  const orderCodes = pkg?.order_codes ?? (post.order_code ? [post.order_code] : []);
  let orderDetails: OrderDetail[] = orderCodes.map((code) => ({
    code,
    shapes_json: null,
    film_name: null,
    film_color: null,
  }));
  // 패키지 합계 가격 = 묶인 주문들의 total_price 합. (개별 가격은 표시 안 함)
  let packageTotal = 0;
  if (orderCodes.length > 0 && pkg?.phone) {
    const summaries = await findOrdersByPhone(supabase, pkg.phone);
    const byCode = new Map(summaries.map((s) => [s.code, s]));
    orderDetails = orderCodes.map((code) => {
      const s = byCode.get(code);
      return {
        code,
        shapes_json: s?.shapes_json ?? null,
        film_name: s?.film_snapshot?.name ?? null,
        film_color: s?.film_snapshot?.color_hex ?? null,
      };
    });
    packageTotal = orderCodes.reduce((sum, code) => sum + (byCode.get(code)?.total_price ?? 0), 0);
  }

  // 블로그 등 임베드 불가 외부 링크는 서버에서 본문 HTML을 직접 추출해서
  // 우리 페이지 안에 인라인 렌더한다. 실패 시 null → OG 카드 폴백.
  let extracted: ExtractedArticle | null = null;
  if (
    post.post_type === POST_TYPE.LINK &&
    post.external_url &&
    post.source_platform === SOURCE_PLATFORM.BLOG
  ) {
    extracted = await getExtractedCached(post.external_url);
  }

  // 외부 글 OG 메타 — 저작권 의도로 DB 에 저장하지 않으므로 매 요청 fresh fetch.
  // 임베드형(YouTube/Instagram) 캡션 / 블로그 본문 추출 실패 시 OG 카드 폴백에만 사용.
  // 페이지당 1 fetch — ISR 60s 안에서 재사용되므로 부담 미미.
  let freshOg: OgMeta | null = null;
  const needsOg =
    post.post_type === POST_TYPE.LINK &&
    !!post.external_url &&
    (post.source_platform !== SOURCE_PLATFORM.BLOG || extracted === null);
  if (needsOg && post.external_url) {
    try {
      freshOg = await fetchOgMeta(post.external_url);
    } catch {
      freshOg = null;
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-ink-60 hover:underline"
        >
          ← 목록으로
        </Link>

        {/* 상단 패키지 강조 영역 — 페이지 진입 시 가장 먼저 보이게. 칩 클릭 시 상세. */}
        <OrderPackagePanel packageCode={post.package_code} details={orderDetails} totalPrice={packageTotal} />

        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {decodeEntities(post.title) || '(제목 없음)'}
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
            <LinkPostBody post={post} extracted={extracted} freshOg={freshOg} />
          )}
        </div>

        {/* 좋아요 — 본문 바로 아래, 우측 정렬 */}
        <div className="mt-8 flex justify-end">
          <LikeButton postId={post.id} initialCount={likeCount} />
        </div>

        {/* 댓글 */}
        <CommentsSection postId={post.id} />
      </main>
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
  freshOg,
}: {
  post: Post;
  extracted: ExtractedArticle | null;
  freshOg: OgMeta | null;
}) {
  if (!post.external_url) return null;

  const embedUrl = isEmbeddable(post.source_platform)
    ? toEmbedUrl(post.external_url, post.source_platform!)
    : null;
  // Instagram 임베드는 세로로 길어 16:9(aspect-video)에 안 맞음 → 별도 사이징.
  const isInstagram = post.source_platform === SOURCE_PLATFORM.INSTAGRAM;
  // 임베드형(youtube/instagram)은 본문 추출을 안 하므로 fresh OG description 을
  // 캡션으로 노출. DB 의 og_description 은 더 이상 저장하지 않음.
  const caption = embedUrl && freshOg?.description ? decodeEntities(freshOg.description) : '';

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
        isInstagram ? (
          // Instagram — 세로 카드. 고정 높이 + 폭 제한, 중앙 정렬. 내부 스크롤 최소화.
          <div className="mx-auto w-full max-w-[540px] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <iframe
              src={embedUrl}
              className="h-[720px] w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          // YouTube — 16:9 임베드
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
        )
      ) : extracted ? (
        // 블로그 본문을 서버에서 직접 추출 — 사이트 안에 인라인 렌더
        <ExtractedBody extracted={extracted} />
      ) : (
        // 본문 추출도 실패 — fresh OG 카드 폴백 (DB 에 og_* 저장 안 하므로 매번 fetch)
        <a
          href={post.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          {freshOg?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxyIfNeeded(freshOg.image) ?? ''} alt="" className="aspect-video w-full object-cover" />
          )}
          <div className="p-4">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {freshOg?.title ? decodeEntities(freshOg.title) : post.external_url}
            </div>
            {freshOg?.description && (
              <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                {decodeEntities(freshOg.description)}
              </p>
            )}
            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
              본문을 가져오지 못했어요. 원본 페이지에서 확인해 주세요.
            </div>
          </div>
        </a>
      )}

      {/* 임베드형 글의 캡션 — Instagram/YouTube는 본문 추출을 안 하므로 og_description 노출 */}
      {caption && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {caption}
        </p>
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
