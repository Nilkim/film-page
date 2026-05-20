// 메인 페이지 — 카드 그리드.
//
// 첫 번째 카드는 항상 "직접 만들기"(FilmCutting 외부 에디터 진입),
// 그 다음부터는 film_page_posts에서 가져온 게시글들.
//
// 필터/정렬은 URL searchParams로 제어:
//   ?mine=1        → 로그인 사용자 본인 글만
//   ?sort=likes    → 좋아요순 / sort=comments → 댓글순 / 없으면 최신순
// 좋아요·댓글 카운트는 nested count라 DB에서 .order()가 안 돼, 가져온 뒤
// 메모리에서 정렬한다(limit 60이라 비용 무시 가능).
//
// Server Component — Supabase server client로 직접 쿼리. RLS의
// select_all 정책 덕분에 비로그인 사용자도 피드를 볼 수 있음.
import { Suspense } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import CreateCard from '@/components/CreateCard';
import PostCard from '@/components/PostCard';
import FeedControls from '@/components/FeedControls';
import { createClient } from '@/lib/supabase/server';
import { TABLE, type Post } from '@/lib/db';

type PostWithCounts = Post & {
  film_page_likes?: { count: number }[];
  film_page_comments?: { count: number }[];
};

const likesOf = (p: PostWithCounts) => p.film_page_likes?.[0]?.count ?? 0;
const commentsOf = (p: PostWithCounts) => p.film_page_comments?.[0]?.count ?? 0;

export default async function Home(props: PageProps<'/'>) {
  const sp = await props.searchParams;
  const sort = typeof sp?.sort === 'string' ? sp.sort : 'latest';
  const mine = sp?.mine === '1';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // nested count로 N+1 회피 — 한 번에 좋아요/댓글 카운트까지 같이 가져옴.
  // Supabase JS는 reverse relationship을 자동 감지(post_id FK 기반).
  let query = supabase
    .from(TABLE.POSTS)
    .select('*, film_page_likes(count), film_page_comments(count)')
    .order('created_at', { ascending: false })
    .limit(60);
  // 내글보기 — 로그인 사용자 본인 글만. 비로그인이면 무시.
  if (mine && user) query = query.eq('user_id', user.id);

  const { data: posts } = await query;
  let list: PostWithCounts[] = (posts as PostWithCounts[] | null) ?? [];

  // 좋아요/댓글 정렬은 메모리에서. 최신순은 이미 DB order로 끝남.
  if (sort === 'likes') list = [...list].sort((a, b) => likesOf(b) - likesOf(a));
  else if (sort === 'comments') list = [...list].sort((a, b) => commentsOf(b) - commentsOf(a));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-[clamp(16px,4vw,40px)]">
      <Header />

      <main className="flex-1">
        {/* 섹션 헤딩 행 — 좌측 H1 + 우측 글쓰기/내글보기/정렬 컨트롤 */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3 py-[26px] pb-4">
          <h1 className="text-[clamp(20px,2.4vw,24px)] font-bold tracking-[-0.02em] text-balance">
            자신만의 필름아트웍 자랑해보세요
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <Link
                href="/posts/new"
                className="whitespace-nowrap border border-ink bg-ink px-3.5 py-[7px] text-xs tracking-[0.08em] text-bg transition-colors duration-150 hover:bg-transparent hover:text-ink"
              >
                + 글쓰기
              </Link>
            )}
            {/* useSearchParams 사용 — dynamic 페이지지만 Suspense로 감싸 경고 회피 */}
            <Suspense fallback={null}>
              <FeedControls isLoggedIn={!!user} />
            </Suspense>
          </div>
        </div>

        {/* auto-fill 그리드: 데스크탑 min 220px·gap 25px, ≤480px min 160px·gap 16px */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[25px] pt-1 pb-8 max-[480px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[480px]:gap-4">
          {/* 내글보기 중에는 CTA 카드 숨김 — 내 글 목록에 외부 진입 타일이 섞이면 어색 */}
          {!mine && <CreateCard />}
          {list.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              index={i + 1}
              currentUserId={user?.id ?? null}
              likeCount={likesOf(p)}
              commentCount={commentsOf(p)}
            />
          ))}
        </div>

        {list.length === 0 && (
          <p className="mt-8 text-center text-sm text-ink-45">
            {mine
              ? '아직 작성한 글이 없어요. 첫 글을 작성해 보세요!'
              : user
                ? '아직 게시글이 없어요. 첫 글을 작성해 보세요!'
                : '아직 게시글이 없어요. 로그인 후 첫 글을 남길 수 있어요.'}
          </p>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink py-3.5 text-[11px] tracking-[0.06em] text-ink-60">
        <span>© {new Date().getFullYear()} Cotyledon</span>
        <span>필름 커팅 작품 커뮤니티</span>
      </footer>
    </div>
  );
}
