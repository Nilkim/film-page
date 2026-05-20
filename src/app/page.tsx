// 메인 페이지 — 카드 그리드.
//
// 첫 번째 카드는 항상 "직접 만들기"(FilmCutting 외부 에디터 진입),
// 그 다음부터는 film_page_posts에서 최신순으로 가져온 게시글들.
//
// Server Component — Supabase server client로 직접 쿼리. RLS의
// select_all 정책 덕분에 비로그인 사용자도 피드를 볼 수 있음.
import Header from '@/components/Header';
import CreateCard from '@/components/CreateCard';
import PostCard from '@/components/PostCard';
import { createClient } from '@/lib/supabase/server';
import { TABLE, type Post } from '@/lib/db';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // nested count로 N+1 회피 — 한 번에 좋아요/댓글 카운트까지 같이 가져옴.
  // Supabase JS는 reverse relationship을 자동 감지(post_id FK 기반).
  const { data: posts } = await supabase
    .from(TABLE.POSTS)
    .select('*, film_page_likes(count), film_page_comments(count)')
    .order('created_at', { ascending: false })
    .limit(60);

  type PostWithCounts = Post & {
    film_page_likes?: { count: number }[];
    film_page_comments?: { count: number }[];
  };
  const list: PostWithCounts[] = (posts as PostWithCounts[] | null) ?? [];

  // 카드 개수 메타: "NN ITEMS · ALL" (2자리 zero-pad).
  const itemCount = String(list.length).padStart(2, '0');

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-[clamp(16px,4vw,40px)]">
      <Header />

      <main className="flex-1">
        {/* 섹션 헤딩 행 — 좌측 H1 + 우측 카운트 메타, baseline 정렬 */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-[26px] pb-4">
          <h1 className="text-[clamp(20px,2.4vw,24px)] font-bold tracking-[-0.02em] text-balance">
            자신만의 필름아트웍 자랑해보세요
          </h1>
          <span className="text-[11px] tracking-[0.18em] text-ink-45">
            {itemCount} ITEMS · ALL
          </span>
        </div>

        {/* auto-fill 그리드: 데스크탑 min 220px·gap 25px, ≤480px min 160px·gap 16px */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[25px] pt-1 pb-8 max-[480px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[480px]:gap-4">
          <CreateCard />
          {list.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              index={i + 1}
              currentUserId={user?.id ?? null}
              likeCount={p.film_page_likes?.[0]?.count ?? 0}
              commentCount={p.film_page_comments?.[0]?.count ?? 0}
            />
          ))}
        </div>

        {list.length === 0 && (
          <p className="mt-8 text-center text-sm text-ink-45">
            아직 게시글이 없어요. {user ? '첫 글을 작성해 보세요!' : '로그인 후 첫 글을 남길 수 있어요.'}
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
