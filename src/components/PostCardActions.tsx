// 본인 글 카드 우상단에 뜨는 수정/삭제 아이콘 (client component).
//
// 카드 외곽이 <Link>로 감싸있어서 내부 anchor/button을 중첩하면 invalid HTML.
// 그래서 PostCard 컴포넌트 안에서 sibling 위치(absolute)로 배치한다.
'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { deletePost } from '@/app/posts/actions';

export default function PostCardActions({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) return;
    startTransition(async () => {
      try {
        await deletePost(postId);
      } catch (err) {
        alert(err instanceof Error ? err.message : '삭제 실패');
      }
    });
  }

  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1">
      <Link
        href={`/posts/${postId}/edit`}
        aria-label="수정"
        className="rounded-full bg-white/90 p-1.5 text-zinc-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-zinc-900 dark:bg-zinc-950/90 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-zinc-50"
      >
        <PencilIcon />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        aria-label="삭제"
        className="rounded-full bg-white/90 p-1.5 text-zinc-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-red-600 disabled:opacity-50 dark:bg-zinc-950/90 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-red-400"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
