// OAuth callback Route Handler.
//
// Supabase가 Google OAuth 완료 후 ?code=<...>로 이 URL을 호출한다.
// 우리는 그 code를 session으로 교환하고(서버 사이드, secure) 사용자를
// 원래 가려던 곳(또는 홈)으로 redirect.
//
// 이 라우트가 안 돌아가면 로그인 후 사용자가 빈 화면이나 에러를 봄 —
// OAuth 흐름의 핵심 매개체.
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// provider 식별자 → 사용자에게 보여줄 한글 이름.
const PROVIDER_LABEL: Record<string, string> = {
  google: '구글',
  kakao: '카카오',
  'custom:naver': '네이버',
  email: '이메일/비밀번호',
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // 로그인 시 redirectTo에 함께 보냈을 수도 있는 next 파라미터 — 향후
  // 로그인 후 특정 페이지(예: 작성 중이던 글로 복귀)로 보낼 때 사용.
  // 지금은 사용자 결정으로 홈(/)으로 단순 이동.
  const next = searchParams.get('next') ?? '/';

  // OAuth 에러 — Supabase 가 provider 흐름 실패 시 ?error & ?error_description 으로 돌려보냄.
  // 우리 네이버 프록시가 중복 이메일을 막으면 error_description 에 'EMAIL_TAKEN:<provider>'
  // 센티넬이 실려온다(makeRequest 가 프록시 응답 body 를 그대로 error_description 으로 전달).
  const errorDesc = searchParams.get('error_description');
  const error = searchParams.get('error');
  if (errorDesc || error) {
    let message = '로그인에 실패했어요. 잠시 후 다시 시도해주세요.';
    const taken = errorDesc?.match(/EMAIL_TAKEN:([^\s&]+)/);
    if (taken) {
      const label = PROVIDER_LABEL[taken[1]] ?? '다른 방법';
      message = `이미 ${label} 계정으로 가입된 이메일이에요. 기존 방법(${label})으로 로그인해주세요.`;
    }
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // 교환 실패 — 로그인 페이지로 에러 메시지와 함께 돌려보냄.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // code 없음 — 비정상 진입. 홈으로.
  return NextResponse.redirect(`${origin}/`);
}
