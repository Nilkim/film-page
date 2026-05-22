// 좋아요 토글 버튼 (client component).
//
// 페이지가 ISR 캐시되므로 내 좋아요 여부/로그인 상태는 서버가 아니라 여기서(브라우저)
// 확인한다. 카운트는 서버가 넘긴 공개값(initialCount)을 먼저 보여주고, 마운트 시 최신값으로 보정.
// 클릭 시 optimistic update + Server Action 호출 + 결과로 보정. 비로그인은 /login 안내.
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TABLE } from '@/lib/db';
import { toggleLike } from '@/app/posts/[id]/interactions-actions';

export default function LikeButton({
  postId,
  initialCount,
}: {
  postId: string;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 마운트 시 로그인 여부 + 내 좋아요 여부 + 최신 카운트를 브라우저에서 조회.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setIsLoggedIn(!!user);
      const [mine, total] = await Promise.all([
        user
          ? supabase.from(TABLE.LIKES).select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from(TABLE.LIKES).select('post_id', { count: 'exact', head: true }).eq('post_id', postId),
      ]);
      if (!active) return;
      setLiked(!!mine.data);
      if (typeof total.count === 'number') setCount(total.count);
    })();
    return () => { active = false; };
  }, [postId]);

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
