// 결제 페이지 — server wrapper. 폼은 클라이언트에서.
//
// 카트 정보가 localStorage 이므로 SSR 의미 없음 → force-dynamic + private cache.
import Header from '@/components/Header';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <Header />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold text-ink">결제</h1>
        <p className="mt-1 text-sm text-ink-60">
          회원가입 없이 결제할 수 있어요. 주문 확인은 전화번호 + 주문번호로 가능합니다.
        </p>
        <CheckoutForm />
      </main>
    </div>
  );
}
