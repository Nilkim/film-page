// 댓글 영역 — client component. 댓글 목록과 로그인 상태를 브라우저에서 로드한다.
//
// 상세 페이지를 ISR로 캐시하기 위해 서버 getUser/댓글조회를 클라이언트로 옮겼다.
// 부수 효과: 댓글 작성/삭제가 즉시 반영된다(서버 액션 후 reload).
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TABLE } from '@/lib/db';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export default function CommentsSection({ postId }: { postId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from(TABLE.COMMENTS)
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    setComments((data as CommentRow[] | null) ?? []);
  }, [postId]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(data.user?.id ?? null);
      await reload();
      if (active) setLoaded(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [reload]);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        댓글 {comments.length > 0 && <span className="text-zinc-500">({comments.length})</span>}
      </h2>

      {/* 작성 폼 또는 로그인 안내 */}
      {userId ? (
        <div className="mt-4">
          <CommentForm postId={postId} onPosted={reload} />
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
      {loaded && comments.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          첫 댓글을 남겨 보세요.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwner={!!userId && userId === c.user_id}
              onDeleted={reload}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
