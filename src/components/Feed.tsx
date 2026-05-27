// 홈 피드 본문 — client. ISR로 캐시된 공개 게시글 목록을 받아, 인증/정렬/내글 필터를
// 브라우저에서 처리한다.
//
// 이 분리의 목적: page.tsx(서버)는 쿠키/인증을 안 건드려 ISR로 CDN 캐시되고,
// 개인화(글쓰기·내글보기 노출, 본인글 아이콘, 정렬·필터)는 여기서 hydration 후 처리.
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Post } from '@/lib/db';
import CreateCard from '@/components/CreateCard';
import PostCard from '@/components/PostCard';
import FeedControls from '@/components/FeedControls';

export type FeedPost = Post & {
  likeCount: number;
  commentCount: number;
  displayPrice: number;
  originalPrice: number;
  hasDiscount: boolean;
};

function FeedInner({ posts }: { posts: FeedPost[] }) {
  const sp = useSearchParams();
  const sort = sp.get('sort') ?? 'latest';
  const mine = sp.get('mine') === '1';

  // 현재 사용자 — 브라우저에서 1회 취득 + 로그인/아웃 변화 구독.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const isLoggedIn = !!userId;

  // 정렬/필터는 클라이언트에서(최대 60개라 비용 무시). mine은 로그인+본인글만.
  const list = useMemo(() => {
    let out = posts;
    if (mine && userId) out = out.filter((p) => p.user_id === userId);
    if (sort === 'likes') out = [...out].sort((a, b) => b.likeCount - a.likeCount);
    else if (sort === 'comments') out = [...out].sort((a, b) => b.commentCount - a.commentCount);
    // latest는 서버가 created_at desc로 이미 정렬해 전달.
    return out;
  }, [posts, mine, userId, sort]);

  return (
    <main className="flex-1">
      {/* 섹션 헤딩 행 — 좌측 H1 + 우측 글쓰기/내글보기/정렬 컨트롤 */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3 py-[26px] pb-4">
        <h1 className="text-[clamp(20px,2.4vw,24px)] font-bold tracking-[-0.02em] text-balance">
          자신만의 필름아트웍 자랑해보세요
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {isLoggedIn && (
            <Link
              href="/posts/new"
              className="whitespace-nowrap border border-ink bg-ink px-3.5 py-[7px] text-xs tracking-[0.08em] text-bg transition-colors duration-150 hover:bg-transparent hover:text-ink"
            >
              + 글쓰기
            </Link>
          )}
          <FeedControls isLoggedIn={isLoggedIn} />
        </div>
      </div>

      {/* auto-fill 그리드: 데스크탑 min 220px·gap 25px, ≤480px min 160px·gap 16px */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[25px] pt-1 pb-8 max-[480px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[480px]:gap-4">
        {/* 내글보기 중에는 CTA 카드 숨김 */}
        {!mine && <CreateCard />}
        {list.map((p, i) => (
          <PostCard
            key={p.id}
            post={p}
            index={i + 1}
            currentUserId={userId}
            likeCount={p.likeCount}
            commentCount={p.commentCount}
            displayPrice={p.displayPrice}
            originalPrice={p.originalPrice}
            hasDiscount={p.hasDiscount}
          />
        ))}
      </div>

      {list.length === 0 && (
        <p className="mt-8 text-center text-sm text-ink-45">
          {mine
            ? '아직 작성한 글이 없어요. 첫 글을 작성해 보세요!'
            : '아직 게시글이 없어요. 로그인 후 첫 글을 남길 수 있어요.'}
        </p>
      )}
    </main>
  );
}

// useSearchParams는 Suspense 경계가 필요(정적 빌드에서 CSR bailout 방지).
export default function Feed({ posts }: { posts: FeedPost[] }) {
  return (
    <Suspense fallback={null}>
      <FeedInner posts={posts} />
    </Suspense>
  );
}
