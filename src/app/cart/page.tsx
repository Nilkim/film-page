// /cart — server wrapper. Suspense 로 client view 를 감싸 useSearchParams() 의 prerender bail-out 회피.
//
// 카트는 동적이지만 셸(헤더)은 server 에서 렌더할 수 있다. dynamic = 'force-dynamic' 로
// prerender 시도 자체를 막아 안전 + Suspense fallback 으로 hydration 직전까지의 깜빡임을 줄임.
import { Suspense } from 'react';
import Header from '@/components/Header';
import CartView from './CartView';

export const dynamic = 'force-dynamic';

export default function CartPage() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
            <h1 className="text-2xl font-bold text-ink">장바구니</h1>
            <div className="mt-8 text-sm text-ink-60">불러오는 중…</div>
          </main>
        }
      >
        <CartView />
      </Suspense>
    </div>
  );
}
