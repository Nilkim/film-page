// 게시글 수정 페이지 — 본인 글만 접근 가능.
//
// Server Component로 인증 + 소유 확인 후 EditPostForm(client)에 기존 데이터 전달.
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { TABLE, type Post } from '@/lib/db';
import EditPostForm from './EditPostForm';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from(TABLE.POSTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) notFound();
  const post = data as Post;

  // 본인 글이 아니면 상세 페이지로 돌려보냄. (notFound로 가도 되지만
  // "남의 글이라 못 봐요" 안내가 명확한 redirect가 더 친절)
  if (post.user_id !== user.id) {
    redirect(`/posts/${id}`);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            글 수정
          </h1>
          <Link
            href={`/posts/${id}`}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            취소 →
          </Link>
        </div>
        <EditPostForm post={post} />
      </main>
    </div>
  );
}
