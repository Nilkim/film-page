'use client';

// 로그인 페이지 — Google / Kakao / Naver OAuth 진입점.
//
// 동선: 버튼 클릭 → Supabase가 provider login URL로 redirect → 사용자 인증 →
// provider가 Supabase로 redirect → Supabase가 우리 앱의 /auth/callback으로 redirect
// (code 포함) → callback이 code를 session으로 교환 → 홈(/)으로 이동.
//
// provider 종류:
//   - 'google', 'kakao' : Supabase 기본 제공 프로바이더 (대시보드에서 enable + client id/secret)
//   - 'custom:naver'     : 네이버는 기본 미지원 → Supabase Custom OAuth2 Provider로 추가.
//     대시보드에서 slug를 'naver'로 만들어야 'custom:naver'와 매칭됨. (무료 플랜 커스텀 3개까지)
//   각 provider는 Supabase/외부 콘솔 설정이 끝나야 실제 동작한다(설정 전 클릭 시 에러).
import { createClient } from '@/lib/supabase/client';
import type { Provider } from '@supabase/supabase-js';
import Link from 'next/link';

export default function LoginPage() {
  const login = async (provider: string) => {
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      // custom provider('custom:naver')는 기본 Provider 유니온에 없어 캐스팅.
      provider: provider as Provider,
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) alert(`로그인 시작 실패: ${error.message}`);
    // 성공 시 자동으로 provider 로그인 페이지로 redirect됨.
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          로그인
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          글 작성 / 댓글 / 좋아요는 로그인이 필요해요. 구경은 비로그인으로 가능합니다.
        </p>

        <div className="space-y-2.5">
          {/* Google — 흰 배경 */}
          <button
            type="button"
            onClick={() => login('google')}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>

          {/* Kakao — 카카오 옐로우 */}
          <button
            type="button"
            onClick={() => login('kakao')}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#FEE500] px-6 py-3 text-sm font-medium text-[#191600] transition-opacity hover:opacity-90"
          >
            <KakaoIcon />
            카카오로 계속하기
          </button>

          {/* Naver — 네이버 그린 (Custom OAuth2 provider) */}
          <button
            type="button"
            onClick={() => login('custom:naver')}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#03C75A] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <NaverIcon />
            네이버로 계속하기
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/" className="hover:underline">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

// Google 로고 — 인라인 SVG.
function GoogleIcon() {
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
function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="#191600" aria-hidden="true">
      <path d="M9 1.5C4.86 1.5 1.5 4.13 1.5 7.38c0 2.1 1.4 3.94 3.5 4.98-.15.53-.56 1.93-.64 2.23-.1.37.14.37.29.27.12-.08 1.86-1.26 2.62-1.78.4.06.81.09 1.23.09 4.14 0 7.5-2.63 7.5-5.88S13.14 1.5 9 1.5z" />
    </svg>
  );
}

// Naver "N" 심볼.
function NaverIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff" aria-hidden="true">
      <path d="M12.3 10.2 7.4 3H3v14h4.7V9.8L12.6 17H17V3h-4.7z" />
    </svg>
  );
}
