'use client';

// 로그인 페이지 — Google OAuth 진입점.
//
// 동선: 사용자가 "Google로 계속하기" 클릭 → Supabase가 Google login URL로
// redirect → 사용자 Google에서 인증 → Google이 Supabase로 redirect →
// Supabase가 우리 앱의 /auth/callback으로 redirect (code 포함) →
// callback이 code를 session으로 교환 → 홈(/)으로 이동.
//
// 향후 다른 OAuth provider 추가 시 같은 패턴으로 버튼 추가 가능
// (signInWithOAuth({ provider: 'kakao' | 'apple' | ... })).
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    // redirectTo는 OAuth 완료 후 Supabase가 우리 앱으로 다시 보낼 URL.
    // /auth/callback에서 code를 받아 session으로 교환.
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      alert(`로그인 시작 실패: ${error.message}`);
    }
    // 성공 시 자동으로 Google 로그인 페이지로 redirect됨 — 별도 처리 X.
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          로그인
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          글 작성 / 댓글 / 좋아요는 로그인이 필요해요. 구경은 비로그인으로
          가능합니다.
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <GoogleIcon />
          Google로 계속하기
        </button>

        <div className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/" className="hover:underline">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

// Google 로고 — 단순 인라인 SVG로 외부 의존성 X.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
