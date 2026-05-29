// 헤더 우측 인증 영역 — client. 브라우저에서 세션을 읽어 로그인/로그아웃 UI를 렌더.
//
// 모바일: 정사각형 아이콘 버튼들 (카트·주문조회·관리자·로그아웃) 한 줄 우측 정렬.
// 데스크탑(sm 이상): 아이콘 + 라벨 형태 + 사용자 아바타·이름 표시.
// 모든 액션이 동일 높이(h-9 / sm:h-[31px])라 시각적 일관성 유지.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
          <LookupIcon />
          <span className="hidden sm:inline">주문조회</span>
        </Link>

        {admin && (
          <Link href="/admin" className={ICON_BTN} aria-label="관리자">
            <AdminIcon />
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
            <LogoutIcon />
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
        <LookupIcon />
        <span className="hidden sm:inline">주문조회</span>
      </Link>
      <Link href="/login" className={ICON_BTN_PRIMARY} aria-label="로그인">
        <LoginIcon />
        <span className="hidden sm:inline">로그인</span>
      </Link>
    </nav>
  );
}

// ─── 픽토그램 ─────────────────────────────────────
// 모두 24×24 viewBox, stroke-only, currentColor — 모바일/데스크탑 동일 굵기.

function LookupIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] sm:h-4 sm:w-4"
      aria-hidden="true"
    >
      {/* 영수증 + 돋보기 — 주문 검색 의미 */}
      <path d="M7 3h8l3 3v13a1 1 0 0 1-1.4.9l-1.6-.7-1.6.8-1.6-.8-1.6.8-1.6-.8-1.6.7A1 1 0 0 1 6 19V4a1 1 0 0 1 1-1z" />
      <line x1="9" y1="8" x2="14" y2="8" />
      <line x1="9" y1="11.5" x2="14" y2="11.5" />
      <circle cx="11.5" cy="15.5" r="1.6" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] sm:h-4 sm:w-4"
      aria-hidden="true"
    >
      {/* 톱니바퀴 — 설정/관리자 의미 */}
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] sm:h-4 sm:w-4"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] sm:h-4 sm:w-4"
      aria-hidden="true"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}
