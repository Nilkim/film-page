// 댓글 작성 폼 (client component).
//
// Server Action 호출 후 textarea 비우기 + pending 표시.
'use client';

import { useRef, useTransition } from 'react';
import { addComment } from '@/app/posts/[id]/interactions-actions';

export default function CommentForm({
  postId,
  onPosted,
}: {
  postId: string;
  onPosted?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function action(formData: FormData) {
    startTransition(async () => {
      try {
        await addComment(postId, formData);
        formRef.current?.reset();
        onPosted?.();
      } catch (err) {
        alert(err instanceof Error ? err.message : '댓글 작성 실패');
      }
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <textarea
        name="body"
        required
        rows={3}
        maxLength={2000}
        placeholder="댓글을 입력하세요"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-50"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? '작성 중…' : '댓글 작성'}
        </button>
      </div>
    </form>
  );
}
