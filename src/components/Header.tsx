// 사이트 헤더 — 로그인 상태에 따라 다르게 표시.
//
// 서버 컴포넌트로 동작 — 매 요청마다 Supabase 세션을 읽어 로그인 여부
// 판단. 로그아웃 액션은 Server Action으로 분리(`<form action={signOut}>`)
// 해 client component 없이도 동작.
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { signOut } from '@/app/actions/auth';

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-bold text-zinc-900 hover:opacity-80 dark:text-zinc-50"
        >
          FilmPage
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">
                {user.user_metadata?.full_name ?? user.email}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
