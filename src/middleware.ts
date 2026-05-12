// Supabase 세션 쿠키 자동 갱신 미들웨어.
//
// 모든 요청에서 Supabase 클라이언트를 만들고 getUser()를 호출하면, 만료된
// 액세스 토큰이 자동으로 refresh되어 새 쿠키가 응답에 set됨. 이렇게 해야
// RSC/Route Handler에서 항상 최신 세션 상태를 볼 수 있다.
//
// 공식 가이드(@supabase/ssr) 권장 구조 — 단순히 클라이언트 만들고 getUser
// 한 번 호출하면 끝. 세션 검증/refresh는 라이브러리가 알아서 처리.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 토큰 refresh를 트리거 (반환값은 사용 안 함).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // 정적 자산은 제외 — middleware 비용 절약.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
