// 게시글 작성 페이지 — 로그인 필수.
//
// Server Component로 인증 가드만 처리하고, 실제 폼은 Client Component로
// 분리. URL 입력 시 디바운스 + /api/og 호출로 OG 메타를 자동 채우는
// 인터랙티브 동작이 필요하기 때문.
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import NewPostForm from './NewPostForm';

export default async function NewPostPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          새 글 작성
        </h1>
        <NewPostForm />
      </main>
    </div>
  );
}
