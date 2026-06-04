// 장바구니 화면 — client. useSearchParams 등 클라 훅을 모두 여기서.
//
// 부모 page.tsx 는 Suspense 로 이걸 감싼다(빌드 시 useSearchParams prerender 회피).
//
// 진입 모드:
//   1. 일반 — /cart  → useCart() 로 렌더만.
//   2. FilmCutting 도면 push — /cart?from=filmcutting&order_code=...&phone=...
//      → useEffect 에서 RPC 호출 → 카트에 push → URL 클린업(replaceState).
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart, cartItemKey } from '@/components/CartProvider';
import PriceTag from '@/components/PriceTag';
import { createClient } from '@/lib/supabase/client';
import { findOrdersByPhone } from '@/lib/orders';
import type { CartItem } from '@/lib/cart';

export default function CartView() {
  const router = useRouter();
  const search = useSearchParams();
  const { cart, ready, subtotal, originalTotal, remove, setQty, clear, add } = useCart();
  const [importing, setImporting] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  // FilmCutting 진입 — 한 번만 처리.
  useEffect(() => {
    if (!ready) return;
    const from = search.get('from');
    const orderCode = search.get('order_code');
    const phone = search.get('phone');
    if (from !== 'filmcutting' || !orderCode || !phone) return;

    // 중복 push 방지.
    const exists = cart.some(
      (it) => it.source === 'filmcutting-order' && it.order_code === orderCode,
    );
    if (exists) {
      cleanUrl();
      return;
    }

    setImporting(orderCode);
    (async () => {
      try {
        const supabase = createClient();
        const summaries = await findOrdersByPhone(supabase, phone);
        const match = summaries.find((s) => s.code === orderCode);
        if (!match) {
          setImportErr('해당 도면을 찾을 수 없어요. 전화번호와 도면번호를 다시 확인해 주세요.');
          return;
        }
        const item: CartItem = {
          source: 'filmcutting-order',
          order_code: match.code,
          phone,
          title: `도면 ${match.code}${match.film_snapshot?.name ? ` (${match.film_snapshot.name})` : ''}`,
          thumb: null,
          price: match.total_price ?? 0,
          qty: 1,
        };
        add(item);
        cleanUrl();
      } catch (e) {
        setImportErr((e as Error).message);
      } finally {
        setImporting(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function cleanUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('from');
    url.searchParams.delete('order_code');
    url.searchParams.delete('phone');
    router.replace(url.pathname + (url.search || ''));
  }

  const hasDiscount = originalTotal > subtotal;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold text-ink">장바구니</h1>

      {importing && (
        <div className="mt-4 rounded border border-card-line bg-ink-06 px-3 py-2 text-sm text-ink-60">
          도면 {importing} 정보를 불러오는 중…
        </div>
      )}
      {importErr && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {importErr}
        </div>
      )}

      {!ready ? (
        <div className="mt-8 text-sm text-ink-60">불러오는 중…</div>
      ) : cart.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <ul className="mt-6 divide-y divide-card-line rounded-[6px] border border-card-line bg-card">
            {cart.map((item) => (
              <CartRow
                key={cartItemKey(item)}
                item={item}
                onRemove={() => remove(cartItemKey(item))}
                onQty={(q) => setQty(cartItemKey(item), q)}
              />
            ))}
          </ul>

          <div className="mt-6 rounded-[6px] border border-card-line bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-60">합계</span>
              <PriceTag
                displayPrice={subtotal}
                originalPrice={originalTotal}
                hasDiscount={hasDiscount}
                size="lg"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm('카트를 비울까요?')) clear();
                }}
                aria-label="카트 비우기"
                title="카트 비우기"
                className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-ink-60 transition-colors hover:bg-ink-06 hover:text-ink"
              >
                <TrashIcon />
                <span className="hidden sm:inline">비우기</span>
              </button>
              <Link
                href="/checkout"
                className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
              >
                결제하기 →
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function CartRow({
  item,
  onRemove,
  onQty,
}: {
  item: CartItem;
  onRemove: () => void;
  onQty: (q: number) => void;
}) {
  const isPkg = item.source === 'post-package';
  const orig = isPkg ? (item.original_price ?? item.price) : item.price;
  const hasDiscount = orig > item.price;

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="flex-none">
        {item.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumb}
            alt=""
            className="size-16 rounded border border-card-line object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-16 place-items-center rounded border border-card-line bg-ink-06 text-[10px] text-ink-45">
            {isPkg ? '패키지' : '도면'}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* 라벨 — 항상 가로 한 줄로 강제(shrink-0 + nowrap), 카드별로 세로/가로 들쭉 방지 */}
          <span className="flex-none whitespace-nowrap rounded bg-ink-06 px-1.5 py-0.5 font-mono text-[10px] tracking-tight text-ink-70">
            {isPkg ? '패키지' : '도면'}
          </span>
          {isPkg ? (
            <Link href={`/posts/${item.post_id}`} className="line-clamp-1 min-w-0 text-sm font-medium text-ink hover:underline">
              {item.title}
            </Link>
          ) : (
            <span className="line-clamp-1 min-w-0 text-sm font-medium text-ink">{item.title}</span>
          )}
        </div>
        <PriceTag
          className="mt-1"
          displayPrice={item.price}
          originalPrice={orig}
          hasDiscount={hasDiscount}
          size="sm"
        />
      </div>

      <div className="flex flex-none items-center gap-3">
        {isPkg ? (
          <div className="flex items-center rounded border border-card-line">
            <button
              type="button"
              onClick={() => onQty(item.qty - 1)}
              disabled={item.qty <= 1}
              className="px-2 py-1 text-sm text-ink-60 hover:text-ink disabled:opacity-30"
              aria-label="수량 감소"
            >
              −
            </button>
            <span className="w-8 text-center text-sm tabular-nums">{item.qty}</span>
            <button
              type="button"
              onClick={() => onQty(item.qty + 1)}
              className="px-2 py-1 text-sm text-ink-60 hover:text-ink"
              aria-label="수량 증가"
            >
              +
            </button>
          </div>
        ) : (
          <span className="text-xs text-ink-45">1개</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="항목 삭제"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-45 transition-colors hover:bg-ink-06 hover:text-ink"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

// 휴지통 픽토그램 — 삭제/비우기 양쪽에서 공통 사용.
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function EmptyCart() {
  return (
    <div className="mt-8 rounded-[6px] border border-card-line bg-card p-8 text-center">
      <p className="text-ink-60">카트가 비어 있어요.</p>
      <Link
        href="/"
        className="mt-3 inline-block text-sm text-ink hover:underline"
      >
        ← 작품 둘러보러 가기
      </Link>
    </div>
  );
}
