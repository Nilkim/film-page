// 본인 글 카드 우상단에 뜨는 수정/삭제 아이콘 (client component).
//
// 카드 외곽이 <Link>로 감싸있어서 내부 anchor/button을 중첩하면 invalid HTML.
// 그래서 PostCard 컴포넌트 안에서 sibling 위치(absolute)로 배치한다.
'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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
        <Pencil size={16} aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        aria-label="삭제"
        className="rounded-full bg-white/90 p-1.5 text-zinc-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-red-600 disabled:opacity-50 dark:bg-zinc-950/90 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-red-400"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
