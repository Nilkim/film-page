// 주문조회 — server wrapper + Suspense.
import { Suspense } from 'react';
import Header from '@/components/Header';
import LookupView from './LookupView';

export const dynamic = 'force-dynamic';

export default function OrdersLookupPage() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
            <h1 className="text-2xl font-bold text-ink">주문조회</h1>
            <div className="mt-6 text-sm text-ink-60">불러오는 중…</div>
          </main>
        }
      >
        <LookupView />
      </Suspense>
    </div>
  );
}
