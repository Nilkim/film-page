// 법적 페이지(이용약관/개인정보처리방침/환불정책) 공통 레이아웃.
//
// 정적 텍스트 위주라 ISR 영향 0. Header/Footer 그대로 + 본문 가로폭 제한 + 인쇄 친화 스타일.
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 py-10 text-[14px] leading-[1.75] text-ink-70">
        {children}
      </main>
      <div className="mx-auto w-full max-w-[1440px] px-[clamp(16px,4vw,40px)]">
        <Footer />
      </div>
    </div>
  );
}
