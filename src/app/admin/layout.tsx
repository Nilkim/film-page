// 관리자 영역 공통 레이아웃 + 게이트.
//
// 게이트:
//   - 비로그인 / 비관리자 이메일 → 홈으로 redirect.
//   - 게이트 단계에서 cookies() 를 읽으므로 /admin/* 는 항상 동적(=ISR 영향 0).
//
// 사이드바 네비 없이 간단한 상단 바 + children. 페이지가 곧 표.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import Header from '@/components/Header';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect('/');
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />
      <div className="border-b border-ink-10 bg-ink-06">
        <nav className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-[clamp(16px,4vw,40px)] py-2 text-xs">
          <span className="font-semibold tracking-[0.18em] text-ink-60 uppercase">관리자</span>
          <Link href="/admin" className="text-ink hover:underline">대시보드</Link>
          <Link href="/admin/posts" className="text-ink hover:underline">게시물·가격</Link>
          <Link href="/admin/orders" className="text-ink hover:underline">주문</Link>
        </nav>
      </div>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-[clamp(16px,4vw,40px)] py-6">
        {children}
      </main>
    </div>
  );
}
