// 메인 페이지의 첫 번째 카드 — "직접 만들기" CTA. (FilmArtwork 핸드오프 디자인)
// FilmCutting 에디터로 이동. 같은 도메인의 /tools 서브경로(Netlify에서 프록시).
//
// 카드 채움 없는 dashed 아웃라인 슬롯. hover 시 미세 배경 틴트 + 보더 강조,
// plus 글리프 90도 회전, go-row 화살표 우측 nudge.
const CUTTING_APP_URL = process.env.NEXT_PUBLIC_CUTTING_URL ?? '/tools';

export default function CreateCard() {
  return (
    <a
      href={CUTTING_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col justify-between rounded-[6px] border-[1.5px] border-dashed border-ink-30 p-[18px] text-center transition-colors duration-200 hover:border-ink hover:bg-[rgba(27,22,16,0.025)]"
    >
      <div>
        <div className="mb-3.5 text-[10px] font-semibold tracking-[0.3em] text-ink-45">
          CREATE NEW
        </div>
        <div className="text-[17px] font-bold leading-[1.3] tracking-[-0.02em] text-ink">
          직접 만들기
          <br />
          커팅 시작하기
        </div>
        {/* plus: hover 시 90도 회전 + 잉크색 강조 */}
        <div className="my-[14px] mb-2.5 text-[44px] font-light leading-none text-ink-45 transition-[transform,color] duration-[250ms] group-hover:rotate-90 group-hover:text-ink">
          +
        </div>
        <div className="mt-2 text-xs leading-[1.55] text-ink-60">
          내 손으로 도면부터 꾸미고,
          <br />
          공유해서 수익까지
        </div>
      </div>

      {/* go-row: 좌측 라벨 + 우측 화살표(hover 시 우측 nudge) */}
      <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-ink-30 pt-2.5 text-[11px] tracking-[0.1em] text-ink-60">
        <span>FilmCutting 에디터</span>
        <span className="text-ink transition-transform duration-[250ms] group-hover:translate-x-1">
          →
        </span>
      </div>
    </a>
  );
}
