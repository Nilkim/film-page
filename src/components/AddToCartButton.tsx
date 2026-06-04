// "장바구니 담기" 버튼 — 게시물 상세 / 카드에서 끼움.
//
// 패키지를 카트에 add. 이미 담겼으면 "담김 ✓ — 카트 보기" 로 전환.
//
// price/original_price 는 서버에서 계산해 props 로 받음 — 클라이언트가 가격을
// 다시 계산하지 않도록(검증 단일 지점 유지).
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Check } from 'lucide-react';
import { useCart } from './CartProvider';
import type { CartItem } from '@/lib/cart';

type Props = {
  packageCode: string;
  postId: string;
  title: string;
  thumb?: string | null;
  price: number;           // 노출가(오버라이드 반영). 0 이면 카트에 못 담음.
  originalPrice?: number;  // 원가(취소선용). 할인 없으면 price 와 동일.
  size?: 'sm' | 'lg';
  className?: string;
};

export default function AddToCartButton({
  packageCode,
  postId,
  title,
  thumb,
  price,
  originalPrice,
  size = 'lg',
  className,
}: Props) {
  const { cart, add, ready } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  // 카트에 이미 같은 package_code 가 있는지.
  const inCart = ready && cart.some(
    (it) => it.source === 'post-package' && it.package_code === packageCode,
  );

  if (price <= 0) {
    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 rounded-full border border-card-line bg-ink-06 px-3 py-1 text-[11px] text-ink-45',
          className,
        ].filter(Boolean).join(' ')}
      >
        가격 정보 없음
      </span>
    );
  }

  function handleAdd() {
    const item: CartItem = {
      source: 'post-package',
      package_code: packageCode,
      post_id: postId,
      title,
      thumb: thumb ?? null,
      price,
      original_price: originalPrice && originalPrice > price ? originalPrice : undefined,
      qty: 1,
    };
    add(item);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1500);
  }

  const big = size === 'lg';
  const base = big
    ? 'h-9 px-4 text-[13px]'
    : 'h-7 px-3 text-[11px]';

  if (inCart || justAdded) {
    return (
      <Link
        href="/cart"
        className={[
          'inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink text-bg transition-opacity hover:opacity-90',
          base,
          className,
        ].filter(Boolean).join(' ')}
      >
        <Check size={14} aria-hidden="true" /> 카트에서 보기
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-ink bg-bg text-ink transition-colors hover:bg-ink hover:text-bg',
        base,
        className,
      ].filter(Boolean).join(' ')}
    >
      <ShoppingCart size={14} aria-hidden="true" /> 장바구니
    </button>
  );
}
