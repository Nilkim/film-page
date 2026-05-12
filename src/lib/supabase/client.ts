// 브라우저(Client Component)용 Supabase 클라이언트.
//
// "use client" 컴포넌트 또는 브라우저에서만 동작하는 이벤트 핸들러에서
// 사용. 쿠키 기반 세션을 자동으로 읽고 갱신함. 매 호출마다 새 클라이언트
// 인스턴스를 만들지 않도록 모듈 레벨 caching은 선택적이지만, @supabase/ssr
// 가이드대로 컴포넌트 안에서 호출하는 패턴을 권장.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
