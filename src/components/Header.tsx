// 사이트 헤더 — FilmArtwork 핸드오프 디자인.
//
// 서버 컴포넌트로 동작 — 매 요청마다 Supabase 세션을 읽어 로그인 여부
// 판단. 로그아웃 액션은 Server Action으로 분리(`<form action={signOut}>`)
// 해 client component 없이도 동작.
//
// 레이아웃: 하단 보더(#1b1610)는 full-bleed, 내부 콘텐츠는 1440px 컬럼에
// clamp 가로 패딩으로 정렬 — main/footer와 동일한 그리드 컬럼.
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { signOut } from '@/app/actions/auth';

// 핸드오프 로그인/로그아웃 버튼: 사각 테두리, hover 시 잉크 채움 + 텍스트 반전.
const ACTION_BTN =
  'whitespace-nowrap border border-ink px-3.5 py-[7px] text-xs tracking-[0.08em] ' +
  'text-ink transition-colors duration-150 hover:bg-ink hover:text-bg';

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-ink">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-[clamp(16px,4vw,40px)] py-[18px]">
        {/* 브랜드 클러스터: 마크 + 워드마크 + COTYLEDON */}
        <Link href="/" className="flex items-center gap-2.5 text-ink hover:opacity-90">
          <span className="inline-flex text-ink leading-none" aria-hidden="true">
            <svg
              viewBox="0 0 32 22"
              width="28"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* handle loops (left) */}
              <circle cx="5" cy="6" r="2.4" />
              <circle cx="5" cy="16" r="2.4" />
              {/* blades crossing into an X */}
              <line x1="7" y1="7.2" x2="20" y2="14.8" />
              <line x1="7" y1="14.8" x2="20" y2="7.2" />
              {/* pivot dot */}
              <circle cx="13.5" cy="11" r="0.85" fill="currentColor" stroke="none" />
              {/* dashed cut path */}
              <line x1="15" y1="11" x2="31" y2="11" strokeDasharray="2.2 2.2" />
            </svg>
          </span>
          <span className="text-[20px] font-bold tracking-[-0.02em]">
            FilmArtwork
            <span className="ml-1 font-medium tracking-[-0.01em] text-ink-60">
              필름아트웍
            </span>
          </span>
          <span className="text-[10px] tracking-[0.32em] text-ink-60">
            — COTYLEDON
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-xs tracking-[0.04em] text-ink-60 sm:inline">
                {user.user_metadata?.full_name ?? user.email}
              </span>
              <form action={signOut}>
                <button type="submit" className={ACTION_BTN}>
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={ACTION_BTN}>
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
