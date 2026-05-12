'use server';

// 인증 관련 Server Actions.
//
// `<form action={signOut}>` 형태로 호출되어 client component 없이도
// 로그아웃 가능. Supabase 세션 쿠키를 서버 사이드에서 삭제 후 홈으로 redirect.
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
