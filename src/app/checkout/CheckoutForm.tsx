// 결제 폼 — 카트 + 고객정보 + PG 선택 + 결제 진행.
//
// 흐름:
//   1. 폼 제출 → createPendingOrder() 서버 액션 → orderNo 받기
//   2. PortOne.requestPayment({ paymentId: orderNo, ... }) 호출 (브라우저 결제창)
//   3. 결제 결과 즉시 /checkout/complete?orderNo=...&phone=... 로 이동
//      (확정은 webhook 이 status='paid' 로. 완료 페이지에서 polling)
//
// 결제창 SDK 는 dynamic import — SSR 영향 차단.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import PriceTag from '@/components/PriceTag';
import { createPendingOrder } from './actions';
import { getClientConfig, providerLabel, payPayload, PG_PROVIDERS, type PgProvider } from '@/lib/portone';
import { buildOrderName } from '@/lib/orders';
import { PgIcon } from '@/components/icons';

// PG 결제창의 customer.email 필수 요건(KG이니시스 V2 등)을 위해 회사 이메일을 자동 사용.
// 영수증·결제확인은 코틸레돈에서 받아 별도 채널로 고객 응대.
const SHOP_EMAIL = 'cotyledon79@naver.com';

export default function CheckoutForm() {
  const router = useRouter();
  const { cart, ready, subtotal, originalTotal, clear } = useCart();
  const [provider, setProvider] = useState<PgProvider>('kakao');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [postal, setPostal] = useState('');
  const [addr, setAddr] = useState('');
  const [addrDetail, setAddrDetail] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const discount = Math.max(0, originalTotal - subtotal);
  const total = subtotal;
  const hasDiscount = discount > 0;
  const orderName = buildOrderName(cart);

  if (!ready) {
    return <div className="mt-8 text-sm text-ink-60">카트를 불러오는 중…</div>;
  }
  if (cart.length === 0) {
    return (
      <div className="mt-8 rounded border border-card-line bg-card p-6 text-center">
        <p className="text-ink-60">카트가 비어 있어요.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-ink underline">
          작품 둘러보러 가기
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await createPendingOrder({
        items: cart,
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: SHOP_EMAIL,
          notifyEmail: notifyEmail.trim() || undefined,
          addr: addr.trim(),
          addrDetail: addrDetail.trim() || undefined,
          postal: postal.trim() || undefined,
          memo: memo.trim() || undefined,
        },
        pgProvider: provider,
        subtotal,
        discount,
        total,
      });
      if (!res.ok) {
        setErr(res.error);
        setBusy(false);
        return;
      }

      // 결제창 SDK 호출 — dynamic import 로 SSR 영향 차단.
      const PortOne = (await import('@portone/browser-sdk/v2')).default;
      const cfg = getClientConfig(provider);
      if (!cfg.storeId || !cfg.channelKey) {
        setErr(
          `${providerLabel(provider)} 결제 채널이 아직 설정되지 않았어요. ` +
          `관리자에게 문의해 주세요. (NEXT_PUBLIC_PORTONE_* 환경변수 누락)`,
        );
        setBusy(false);
        return;
      }

      const response = await PortOne.requestPayment({
        storeId: cfg.storeId,
        channelKey: cfg.channelKey,
        paymentId: res.orderNo,                     // 우리 order_no = 포트원 paymentId
        orderName: orderName.slice(0, 80),
        totalAmount: total,
        currency: 'CURRENCY_KRW',
        // payMethod + easyPay.easyPayProvider 2단 구조 — provider 별로 매핑.
        // 구글페이는 KG이니시스 V2 미지원이라 CARD 로 fallback.
        ...payPayload(provider),
        customer: {
          fullName: name.trim(),
          phoneNumber: phone.trim(),
          email: SHOP_EMAIL,
        },
        customData: { orderNo: res.orderNo },
        // 모바일 환경에서 결제창이 redirect 형식이 될 때만 사용. 같은 도메인의 완료 페이지.
        redirectUrl: `${window.location.origin}/checkout/complete?orderNo=${res.orderNo}&phone=${encodeURIComponent(phone.trim())}`,
      });

      if (response?.code) {
        setErr(response.message || '결제가 취소되었거나 실패했어요.');
        setBusy(false);
        return;
      }

      // PC 환경의 팝업/SDK 결제: 응답 도착 → 완료 페이지로.
      clear();
      router.push(
        `/checkout/complete?orderNo=${res.orderNo}&phone=${encodeURIComponent(phone.trim())}`,
      );
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* 좌측: 입력 폼 */}
      <div className="space-y-5">
        <section className="rounded-[6px] border border-card-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">받는 사람</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="이름 *">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="전화번호 *">
              <input
                type="tel"
                required
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="알림 이메일 (선택)">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-45">
            알림 이메일을 입력하시면 결제완료·발송완료 안내 메일을 받으실 수 있어요. 결제창에는 회사 이메일({SHOP_EMAIL}) 이 자동 입력됩니다.
          </p>
        </section>

        <section className="rounded-[6px] border border-card-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">배송지</h2>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="우편번호">
              <input
                type="text"
                inputMode="numeric"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                className={inputCls + ' max-w-[140px]'}
              />
            </Field>
            <Field label="주소 *">
              <input
                type="text"
                required
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                placeholder="시/도 시/군/구 도로명 + 건물번호"
                className={inputCls}
              />
            </Field>
            <Field label="상세주소">
              <input
                type="text"
                value={addrDetail}
                onChange={(e) => setAddrDetail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="요청사항 (선택)">
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                className={inputCls + ' resize-none'}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-[6px] border border-card-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">결제 수단</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PG_PROVIDERS.map((p) => (
              <label
                key={p}
                className={
                  'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded border px-2 py-3 text-xs font-medium transition-colors ' +
                  (provider === p
                    ? 'border-ink bg-ink text-bg'
                    : 'border-card-line bg-bg text-ink-60 hover:border-ink-60 hover:text-ink')
                }
              >
                <input
                  type="radio"
                  name="pg"
                  value={p}
                  checked={provider === p}
                  onChange={() => setProvider(p)}
                  className="sr-only"
                />
                <PgIcon provider={p} active={provider === p} />
                <span>{providerLabel(p)}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {/* 우측: 주문 요약 */}
      <aside className="space-y-4">
        <section className="rounded-[6px] border border-card-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">주문 요약</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {cart.map((it, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="line-clamp-1 text-ink-70">
                  {it.title} {it.qty > 1 && <span className="text-ink-45">× {it.qty}</span>}
                </span>
                <span className="tabular-nums text-ink">
                  {(it.price * it.qty).toLocaleString('ko-KR')}원
                </span>
              </li>
            ))}
          </ul>
          <hr className="my-3 border-card-line" />
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-60">상품 합계</span>
            <span className="tabular-nums text-ink-70">{subtotal.toLocaleString('ko-KR')}원</span>
          </div>
          {hasDiscount && (
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="text-ink-60">할인</span>
              <span className="tabular-nums text-ink-70">- {discount.toLocaleString('ko-KR')}원</span>
            </div>
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-card-line pt-3">
            <span className="text-sm font-semibold text-ink">총 결제금액</span>
            <PriceTag
              displayPrice={total}
              originalPrice={originalTotal}
              hasDiscount={hasDiscount}
              size="lg"
            />
          </div>
        </section>

        {err && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? '결제창 여는 중…' : `${providerLabel(provider)}로 ${total.toLocaleString('ko-KR')}원 결제`}
        </button>

        <p className="text-[11px] leading-relaxed text-ink-45">
          결제 진행 시{' '}
          <Link href="/" className="underline">이용약관·환불정책</Link>
          에 동의한 것으로 간주됩니다. 결제 정보는 결제 PG(포트원)와 코틸레돈 서버에만 보관됩니다.
        </p>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium tracking-[0.04em] text-ink-60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full rounded border border-card-line bg-bg px-3 py-2 text-sm text-ink ' +
  'focus:border-ink focus:outline-none';
