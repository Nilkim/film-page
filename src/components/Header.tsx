// 사이트 헤더 — FilmArtwork 핸드오프 디자인.
//
// 정적 셸(브랜드)만 서버에서 렌더하고, 인증 영역은 client <HeaderAuth>로 분리했다.
// 서버에서 getUser()(쿠키)를 호출하지 않으므로 홈 페이지가 ISR로 캐시될 수 있다.
//
// 레이아웃: 하단 보더(#1b1610)는 full-bleed, 내부 콘텐츠는 1440px 컬럼에
// clamp 가로 패딩으로 정렬 — main/footer와 동일한 그리드 컬럼.
import Link from 'next/link';
import HeaderAuth from '@/components/HeaderAuth';

export default function Header() {
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

        <HeaderAuth />
      </div>
    </header>
  );
}
