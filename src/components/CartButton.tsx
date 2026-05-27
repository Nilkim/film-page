// 헤더 우측 카트 진입 버튼. 개수 뱃지 + /cart 링크.
//
// 카트가 hydrate 되기 전(ready=false)에는 뱃지 숨김 — 깜빡임 방지.
'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartButton() {
  const { count, ready } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`장바구니 (${count}개)`}
      className="relative inline-flex h-[31px] items-center gap-1.5 border border-ink px-3 text-xs tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bg"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M3 4h2.4l2.5 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.5L22 8H6.5" />
      </svg>
      <span>장바구니</span>
      {ready && count > 0 && (
        <span className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold tabular-nums text-bg ring-1 ring-bg group-hover:bg-bg group-hover:text-ink">
          {count}
        </span>
      )}
    </Link>
  );
}
