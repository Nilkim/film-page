// 쿠키를 건드리지 않는 anon Supabase 클라이언트 — 공개 데이터의 캐시 가능 읽기용.
//
// 왜 별도 클라이언트인가:
//   server.ts의 createClient()는 next/headers의 cookies()를 읽는다. cookies() 호출은
//   해당 렌더를 "동적(dynamic)"으로 만들어 ISR/정적 캐시를 무력화한다.
//   홈 피드처럼 모든 사용자에게 동일한 공개 데이터(RLS select_all)는 쿠키가 필요 없으므로,
//   쿠키를 안 보는 anon 클라이언트로 읽어 페이지가 ISR로 캐시되게 한다.
import { createClient } from '@supabase/supabase-js';

export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
