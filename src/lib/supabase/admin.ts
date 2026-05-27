// service-role 키로 동작하는 Supabase 클라이언트 — RLS 우회용.
//
// 사용처: 관리자 서버 액션 / 결제 webhook 등 "이미 권한이 확인된" 서버 코드.
//
// 보안:
//   - 호출 전 반드시 isAdminEmail() / webhook signature 등의 외부 검증을 통과시킬 것.
//   - 절대 RSC/Client 컴포넌트에서 import 하지 말 것.
//   - SUPABASE_SERVICE_ROLE_KEY 는 NEXT_PUBLIC_ prefix 가 없는 서버 전용 env.
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (또는 NEXT_PUBLIC_SUPABASE_URL) 환경변수가 없습니다.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
