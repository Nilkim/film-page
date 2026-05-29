// 헤더 카트 진입 — 모바일에선 아이콘만(정사각형), 데스크탑은 아이콘+라벨.
//
// 카트 개수 뱃지는 아이콘 우상단에 absolute 로 떠 있어 두 모드 모두 동일하게 보임.
'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartButton() {
  const { count, ready } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`장바구니 (${count}개)`}
      className="relative inline-flex h-9 min-w-[36px] items-center justify-center gap-1.5 border border-ink bg-bg px-2 text-[11px] tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-bg sm:h-[31px] sm:min-w-0 sm:px-3 sm:text-xs"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px] sm:h-4 sm:w-4"
        aria-hidden="true"
      >
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M3 4h2.4l2.5 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.5L22 8H6.5" />
      </svg>
      {/* 라벨은 데스크탑만 노출 */}
      <span className="hidden sm:inline">장바구니</span>
      {/* 카운트 뱃지 — 모바일은 아이콘 우상단, 데스크탑은 라벨 우측 */}
      {ready && count > 0 && (
        <span
          className="absolute -right-1 -top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-ink px-1 text-[9px] font-bold tabular-nums text-bg ring-2 ring-bg sm:static sm:ml-0.5 sm:h-[18px] sm:min-w-[18px] sm:ring-1"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
