// 서버 컴포넌트(RSC) / Route Handler / Server Action용 Supabase 클라이언트.
//
// Next.js의 cookies()를 받아 쿠키 R/W를 위임. SSR/RSC에서 인증된 사용자
// 정보를 읽고, 필요 시 OAuth callback 등에서 쿠키 set도 가능.
//
// 주의: getAll/setAll API를 써야 @supabase/ssr이 PKCE flow의 nonce/
// session cookie를 일관되게 관리. 단순 get/set만 구현하면 일부 흐름이
// 깨질 수 있음 (공식 문서 권장 패턴).
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component에서 cookies.set()을 직접 호출하면 에러나는
            // 경우가 있는데, middleware에서 세션 갱신을 처리하므로 무시 가능.
          }
        },
      },
    },
  );
}
