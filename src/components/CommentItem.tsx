// 댓글 하나 (client component) — 본인 글이면 삭제 버튼.
'use client';

import { useTransition } from 'react';
import { deleteComment } from '@/app/posts/[id]/interactions-actions';
import type { CommentRow } from './CommentsSection';

export default function CommentItem({
  comment,
  isOwner,
}: {
  comment: CommentRow;
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    startTransition(async () => {
      try {
        await deleteComment(comment.id, comment.post_id);
      } catch (err) {
        alert(err instanceof Error ? err.message : '삭제 실패');
      }
    });
  }

  return (
    <li className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>{new Date(comment.created_at).toLocaleString('ko-KR')}</span>
        {isOwner && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
          >
            삭제
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
        {comment.body}
      </p>
    </li>
  );
}
