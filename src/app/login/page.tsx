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
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GoogleIcon, KakaoIcon, NaverIcon } from '@/components/icons';

export default function LoginPage() {
  // /auth/callback 이 OAuth 에러(예: 중복 이메일 차단)를 ?error=<한글메시지> 로 넘겨준다.
  // useSearchParams 의 Suspense 요구를 피하려 client 에서 location 을 직접 읽는다.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error');
    if (err) setNotice(err);
  }, []);

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

        {notice && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {notice}
          </div>
        )}

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
          <Link href="/" className="hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={15} aria-hidden="true" /> 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
