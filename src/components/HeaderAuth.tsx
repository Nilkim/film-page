// 헤더 우측 인증 영역 — client. 브라우저에서 세션을 읽어 로그인/로그아웃 UI를 렌더.
//
// 모바일: 정사각형 아이콘 버튼들 (카트·주문조회·관리자·로그아웃) 한 줄 우측 정렬.
// 데스크탑(sm 이상): 아이콘 + 라벨 형태 + 사용자 아바타·이름 표시.
// 모든 액션이 동일 높이(h-9 / sm:h-[31px])라 시각적 일관성 유지.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PackageSearch, Settings, LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions/auth';
import { isAdminEmail } from '@/lib/admin';
import CartButton from '@/components/CartButton';
import type { User } from '@supabase/supabase-js';

// 통일 아이콘 버튼 스타일 — 카트와 시각 높이/패딩 동일하게 맞춤.
//   - 모바일: 정사각형(h-9 min-w-9) 아이콘 only
//   - 데스크탑: h-[31px] 아이콘 + 라벨
const ICON_BTN =
  'inline-flex h-9 min-w-[36px] items-center justify-center gap-1.5 border border-ink-60 bg-bg px-2 ' +
  'text-[11px] tracking-[0.08em] text-ink-70 transition-colors hover:border-ink hover:bg-ink hover:text-bg ' +
  'sm:h-[31px] sm:min-w-0 sm:px-3 sm:text-xs';

// 강조 액션(로그인·로그아웃) — 잉크 외곽 + 동일 사이즈.
const ICON_BTN_PRIMARY =
  'inline-flex h-9 min-w-[36px] items-center justify-center gap-1.5 border border-ink bg-bg px-2 ' +
  'text-[11px] tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bg ' +
  'sm:h-[31px] sm:min-w-0 sm:px-3 sm:text-xs';

export default function HeaderAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user ?? null);
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 세션 확인 전 — 카트 + 자리 placeholder.
  if (!ready) {
    return (
      <nav className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-2">
        <CartButton />
        <div className="h-9 sm:h-[31px]" aria-hidden="true" />
      </nav>
    );
  }

  if (user) {
    const meta = user.user_metadata ?? {};
    const avatarUrl: string | undefined =
      meta.avatar_url ?? meta.picture ?? meta.profile_image;
    const displayName = meta.full_name ?? meta.name ?? user.email;
    const admin = isAdminEmail(user.email);

    return (
      <nav className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-2">
        <CartButton />

        <Link href="/orders/lookup" className={ICON_BTN} aria-label="주문조회">
          <PackageSearch strokeWidth={1.6} className="h-[18px] w-[18px] sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="hidden sm:inline">주문조회</span>
        </Link>

        {admin && (
          <Link href="/admin" className={ICON_BTN} aria-label="관리자">
            <Settings strokeWidth={1.6} className="h-[18px] w-[18px] sm:h-4 sm:w-4" aria-hidden="true" />
            <span className="hidden sm:inline">관리자</span>
          </Link>
        )}

        {/* 사용자 아바타·이름은 데스크탑만 (모바일 폭 절약) */}
        <span className="hidden items-center gap-2 px-1 text-xs tracking-[0.04em] text-ink-60 sm:inline-flex">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-6 rounded-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="max-w-[120px] truncate">{displayName}</span>
        </span>

        <form action={signOut}>
          <button type="submit" className={ICON_BTN_PRIMARY} aria-label="로그아웃">
            <LogOut strokeWidth={1.6} className="h-[18px] w-[18px] sm:h-4 sm:w-4" aria-hidden="true" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </form>
      </nav>
    );
  }

  // 비로그인 — 카트 + 주문조회 + 로그인.
  return (
    <nav className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-2">
      <CartButton />
      <Link href="/orders/lookup" className={ICON_BTN} aria-label="주문조회">
        <PackageSearch strokeWidth={1.6} className="h-[18px] w-[18px] sm:h-4 sm:w-4" aria-hidden="true" />
        <span className="hidden sm:inline">주문조회</span>
      </Link>
      <Link href="/login" className={ICON_BTN_PRIMARY} aria-label="로그인">
        <LogIn strokeWidth={1.6} className="h-[18px] w-[18px] sm:h-4 sm:w-4" aria-hidden="true" />
        <span className="hidden sm:inline">로그인</span>
      </Link>
    </nav>
  );
}

