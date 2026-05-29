// 헤더 우측 인증 영역 — client. 브라우저에서 세션을 읽어 로그인/로그아웃 UI를 렌더.
//
// Header를 서버 getUser()에서 떼어내 홈을 ISR로 캐시하기 위함. 인증 상태는 hydration
// 후 채워진다(로그인 버튼이 잠깐 보였다가 로그아웃/이름으로 바뀔 수 있음 — 허용).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions/auth';
import { isAdminEmail } from '@/lib/admin';
import CartButton from '@/components/CartButton';
import type { User } from '@supabase/supabase-js';

// 사각 테두리 버튼: hover 시 잉크 채움 + 텍스트 반전.
const ACTION_BTN =
  'whitespace-nowrap border border-ink px-3.5 py-[7px] text-xs tracking-[0.08em] ' +
  'text-ink transition-colors duration-150 hover:bg-ink hover:text-bg';

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

  // 세션 확인 전에는 깜빡임을 줄이려고 자리만 비워둔다.
  // 카트 버튼은 인증 상태와 무관하므로 항상 노출.
  if (!ready) {
    return (
      <nav className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
        <CartButton />
        <div className="h-[31px]" aria-hidden="true" />
      </nav>
    );
  }

  if (user) {
    // OAuth provider 별로 avatar 필드 키가 달라 폴백 체인.
    // Google: avatar_url 또는 picture / Kakao: avatar_url / Naver: profile_image.
    const meta = user.user_metadata ?? {};
    const avatarUrl: string | undefined =
      meta.avatar_url ?? meta.picture ?? meta.profile_image;
    const displayName = meta.full_name ?? meta.name ?? user.email;

    const admin = isAdminEmail(user.email);

    return (
      <nav className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
        <CartButton />
        <Link href="/orders/lookup" className="whitespace-nowrap text-xs tracking-[0.04em] text-ink-60 hover:text-ink">
          주문조회
        </Link>
        {admin && (
          <Link
            href="/admin"
            className="inline-block whitespace-nowrap border border-ink-60 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-ink-60 transition-colors hover:border-ink hover:text-ink"
          >
            관리자
          </Link>
        )}
        <span className="hidden items-center gap-2 text-xs tracking-[0.04em] text-ink-60 sm:inline-flex">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-6 rounded-full object-cover"
              loading="lazy"
              // 일부 provider 가 외부 referer 차단 → no-referrer 로 우회.
              referrerPolicy="no-referrer"
            />
          )}
          <span>{displayName}</span>
        </span>
        <form action={signOut}>
          <button type="submit" className={ACTION_BTN}>
            로그아웃
          </button>
        </form>
      </nav>
    );
  }

  return (
    <nav className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
      <CartButton />
      <Link href="/orders/lookup" className="whitespace-nowrap text-xs tracking-[0.04em] text-ink-60 hover:text-ink">
        주문조회
      </Link>
      <Link href="/login" className={ACTION_BTN}>
        로그인
      </Link>
    </nav>
  );
}
