// 브랜드/결제 픽토그램 모음 — lucide-react 에 없는 로고들을 한 곳에 모음.
//
// lucide-react 는 브랜드 로고(구글/카카오/네이버 등)를 제공하지 않으므로,
// 여러 파일에 흩어져 있던 인라인 브랜드 SVG 를 named export 로 중앙화한다.
// 순수 표현용(훅 없음)이라 'use client' 불필요 — 클라/서버 양쪽에서 import 가능.
import type { PgProvider } from '@/lib/portone';

// Google 로고 — 인라인 SVG.
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

// Kakao 말풍선 심볼.
export function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="#191600" aria-hidden="true">
      <path d="M9 1.5C4.86 1.5 1.5 4.13 1.5 7.38c0 2.1 1.4 3.94 3.5 4.98-.15.53-.56 1.93-.64 2.23-.1.37.14.37.29.27.12-.08 1.86-1.26 2.62-1.78.4.06.81.09 1.23.09 4.14 0 7.5-2.63 7.5-5.88S13.14 1.5 9 1.5z" />
    </svg>
  );
}

// Naver "N" 심볼.
export function NaverIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff" aria-hidden="true">
      <path d="M12.3 10.2 7.4 3H3v14h4.7V9.8L12.6 17H17V3h-4.7z" />
    </svg>
  );
}

// 결제 수단 픽토그램 — provider 별 브랜드 색 + 단순화된 글리프.
// active 일 땐 잉크 채움 배경이라 글자색 흰색.
export function PgIcon({ provider, active }: { provider: PgProvider; active: boolean }) {
  const size = 24;
  switch (provider) {
    case 'card':
      // 신용카드 — 직사각형 + 마그네틱 스트라이프
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <line x1="2.5" y1="10" x2="21.5" y2="10" />
          <line x1="6" y1="15" x2="10" y2="15" />
        </svg>
      );
    case 'kakao':
      // 카카오 — 노란 배경 원에 검은 K (active 시 반전)
      return (
        <span
          className={'inline-flex items-center justify-center rounded-full ' + (active ? 'bg-bg' : 'bg-[#FEE500]')}
          style={{ width: size, height: size }}
        >
          <span className={'text-[11px] font-extrabold leading-none ' + (active ? 'text-[#191600]' : 'text-[#191600]')}>K</span>
        </span>
      );
    case 'naver':
      // 네이버 — 초록 N
      return (
        <span
          className={'inline-flex items-center justify-center rounded-md ' + (active ? 'bg-bg' : 'bg-[#03C75A]')}
          style={{ width: size, height: size }}
        >
          <span className={'text-[12px] font-extrabold leading-none ' + (active ? 'text-[#03C75A]' : 'text-white')}>N</span>
        </span>
      );
    case 'google':
      // 구글 — 흰 배경 원에 G (active 시 반전)
      return (
        <span
          className={'inline-flex items-center justify-center rounded-full border ' + (active ? 'border-bg bg-bg' : 'border-card-line bg-white')}
          style={{ width: size, height: size }}
        >
          <span className="text-[11px] font-bold leading-none text-[#4285F4]">G</span>
        </span>
      );
  }
}
