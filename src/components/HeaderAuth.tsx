// 헤더 우측 인증 영역 — client. 브라우저에서 세션을 읽어 로그인/로그아웃 UI를 렌더.
//
// Header를 서버 getUser()에서 떼어내 홈을 ISR로 캐시하기 위함. 인증 상태는 hydration
// 후 채워진다(로그인 버튼이 잠깐 보였다가 로그아웃/이름으로 바뀔 수 있음 — 허용).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions/auth';
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
  if (!ready) return <div className="h-[31px]" aria-hidden="true" />;

  if (user) {
    return (
      <nav className="flex items-center gap-3">
        <span className="hidden text-xs tracking-[0.04em] text-ink-60 sm:inline">
          {user.user_metadata?.full_name ?? user.email}
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
    <nav className="flex items-center gap-3">
      <Link href="/login" className={ACTION_BTN}>
        로그인
      </Link>
    </nav>
  );
}
