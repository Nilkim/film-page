// 메인 페이지 — 카드 그리드.
//
// 첫 번째 카드는 항상 "직접 만들기"(FilmCutting 외부 에디터 진입),
// 그 다음부터는 film_page_posts에서 최신순으로 가져온 게시글들.
//
// Server Component — Supabase server client로 직접 쿼리. RLS의
// select_all 정책 덕분에 비로그인 사용자도 피드를 볼 수 있음.
import Link from 'next/link';
import Header from '@/components/Header';
import CreateCard from '@/components/CreateCard';
import PostCard from '@/components/PostCard';
import { createClient } from '@/lib/supabase/server';
import { TABLE, type Post } from '@/lib/db';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: posts } = await supabase
    .from(TABLE.POSTS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);

  const list: Post[] = (posts as Post[] | null) ?? [];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            작품 둘러보기
          </h2>
          {user && (
            <Link
              href="/posts/new"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + 새 글
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          <CreateCard />
          {list.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
          ))}
        </div>

        {list.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            아직 게시글이 없어요. {user ? '첫 글을 작성해 보세요!' : '로그인 후 첫 글을 남길 수 있어요.'}
          </p>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        © {new Date().getFullYear()} Cotyledon · 필름 커팅 작품 커뮤니티
      </footer>
    </div>
  );
}
