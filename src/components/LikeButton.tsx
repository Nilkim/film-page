// 좋아요 토글 버튼 (client component).
//
// 초기 상태(liked, count)는 server에서 props로 받음.
// 클릭 시 optimistic update + Server Action 호출 + 결과로 보정.
// 비로그인 사용자는 표시되지만 클릭 시 /login으로 안내.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleLike } from '@/app/posts/[id]/interactions-actions';

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
  isLoggedIn,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    // Optimistic update — UI 즉시 반응.
    const optimistic = { liked: !liked, count: count + (liked ? -1 : 1) };
    setLiked(optimistic.liked);
    setCount(optimistic.count);

    startTransition(async () => {
      try {
        const result = await toggleLike(postId);
        setLiked(result.liked);
        setCount(result.count);
      } catch (err) {
        // 실패 시 roll back.
        setLiked(liked);
        setCount(count);
        alert(err instanceof Error ? err.message : '좋아요 실패');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
        liked
          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
      }`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
