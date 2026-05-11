// FilmPage 커뮤니티 사이트 — MVP 홈
//
// 이번 단계는 사이트 뼈대만 — 사이트 소개 + "커팅 시작하기" 외부 링크.
// 다음 단계 (별도 PR):
//   - 게시글 피드 (Supabase posts 테이블)
//   - Google OAuth 로그인 (Supabase Auth)
//   - 게시글 작성 (인증 필요)
// FilmCutting URL은 환경변수로 추후 분리, 일단 inline.
const CUTTING_APP_URL = "https://filmcutting.netlify.app";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      {/* 상단 네비 */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            FilmPage
          </h1>
          <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
              disabled
              title="로그인 기능은 다음 단계에 추가됩니다"
            >
              로그인
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16">
        <section className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-4xl font-bold leading-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            필름 커팅으로 만든 작품,
            <br />
            여기서 자랑해요.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
            도면을 그려서 주문하고, 만든 작품을 사진과 함께 공유하는 커뮤니티.
            다른 사람의 도면을 보고 영감을 받거나, 같은 도면으로 새 주문을
            만들어 볼 수도 있어요.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={CUTTING_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              커팅 시작하기 →
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              disabled
              title="게시판은 다음 단계에 추가됩니다"
            >
              작품 둘러보기 (준비 중)
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        © {new Date().getFullYear()} Cotyledon · 필름 커팅 작품 커뮤니티
      </footer>
    </div>
  );
}
