// 댓글 영역 — server component로 댓글 목록 조회 후 렌더.
//
// 비로그인 사용자는 폼 대신 "로그인 후 댓글 가능" 안내.
// 본인 댓글엔 삭제 버튼(CommentItem 내부).
import { createClient } from '@/lib/supabase/server';
import { TABLE } from '@/lib/db';
import Link from 'next/link';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export default async function CommentsSection({ postId }: { postId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: comments } = await supabase
    .from(TABLE.COMMENTS)
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const list: CommentRow[] = (comments as CommentRow[] | null) ?? [];

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        댓글 {list.length > 0 && <span className="text-zinc-500">({list.length})</span>}
      </h2>

      {/* 작성 폼 또는 로그인 안내 */}
      {user ? (
        <div className="mt-4">
          <CommentForm postId={postId} />
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          댓글을 작성하려면{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            로그인
          </Link>
          이 필요해요.
        </div>
      )}

      {/* 목록 */}
      {list.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          첫 댓글을 남겨 보세요.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwner={!!user && user.id === c.user_id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
