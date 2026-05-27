// 결제 완료 — server wrapper + Suspense (useSearchParams 회피).
import { Suspense } from 'react';
import Header from '@/components/Header';
import CompleteView from './CompleteView';

export const dynamic = 'force-dynamic';

export default function CheckoutCompletePage() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
            <h1 className="text-2xl font-bold text-ink">결제 완료</h1>
            <div className="mt-6 text-sm text-ink-60">불러오는 중…</div>
          </main>
        }
      >
        <CompleteView />
      </Suspense>
    </div>
  );
}
