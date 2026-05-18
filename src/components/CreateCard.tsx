// 메인 페이지의 첫 번째 카드 — "직접 만들기".
// FilmCutting 외부 에디터로 새 탭 이동.
const CUTTING_APP_URL =
  process.env.NEXT_PUBLIC_CUTTING_URL ?? 'https://filmcutting.netlify.app';

export default function CreateCard() {
  return (
    <a
      href={CUTTING_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-white p-6 text-center transition-colors hover:border-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-50 dark:hover:bg-zinc-900"
    >
      <div className="text-4xl text-zinc-400 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-50">
        +
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        직접 만들기
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        커팅 시작하기 →
      </div>
    </a>
  );
}
