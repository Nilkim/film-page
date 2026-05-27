// 장바구니 — 클라이언트 전용 상태.
//
// 저장소: localStorage. SSR 단계에서는 빈 카트로 hydrate 한 뒤,
// CartProvider 가 mount 후 localStorage 와 동기화한다(hydration mismatch 회피).
//
// 두 진입점:
//   1. PostCard / OrderPackagePanel 의 AddToCartButton → source='post-package'
//   2. FilmCutting OrderCompletePage 에서 /cart?from=filmcutting 으로 들어오면
//      자동 push → source='filmcutting-order'
//
// 같은 source+key 가 들어오면 중복 방지(post-package 는 qty 증가, filmcutting-order 는 skip).

export const CART_STORAGE_KEY = 'filmartwork.cart.v1';
export const MAX_QTY = 99;

export type CartItem =
  | {
      source: 'post-package';
      package_code: string;
      post_id: string;
      title: string;
      thumb?: string | null;
      price: number;          // 결제 시점에 봉인 (오버라이드 반영가)
      original_price?: number; // 취소선 렌더용. 할인 없으면 price 와 동일하거나 생략.
      qty: number;
    }
  | {
      source: 'filmcutting-order';
      order_code: string;
      phone: string;
      title: string;
      thumb?: string | null;
      price: number;
      qty: 1;
    };

// 두 아이템이 "같은 줄로 묶일 수 있는가" — source + 식별자 동일성.
export function isSameItem(a: CartItem, b: CartItem): boolean {
  if (a.source !== b.source) return false;
  if (a.source === 'post-package' && b.source === 'post-package') {
    return a.package_code === b.package_code;
  }
  if (a.source === 'filmcutting-order' && b.source === 'filmcutting-order') {
    return a.order_code === b.order_code;
  }
  return false;
}

export function cartItemKey(item: CartItem): string {
  return item.source === 'post-package'
    ? `pkg:${item.package_code}`
    : `fc:${item.order_code}`;
}

// 항목 1개 + 기존 카트 → 새 카트.
export function addToCart(cart: CartItem[], item: CartItem): CartItem[] {
  const idx = cart.findIndex((c) => isSameItem(c, item));
  if (idx === -1) return [...cart, item];

  // 도면(FilmCutting)은 qty 항상 1 — skip.
  if (item.source === 'filmcutting-order') return cart;

  // 패키지: 수량 증가.
  const next = [...cart];
  const cur = next[idx];
  if (cur.source !== 'post-package') return cart;
  const newQty = Math.min(MAX_QTY, cur.qty + item.qty);
  next[idx] = { ...cur, qty: newQty };
  return next;
}

export function removeFromCart(cart: CartItem[], key: string): CartItem[] {
  return cart.filter((c) => cartItemKey(c) !== key);
}

export function setItemQty(cart: CartItem[], key: string, qty: number): CartItem[] {
  const safeQty = Math.max(1, Math.min(MAX_QTY, Math.floor(qty)));
  return cart.map((c) => {
    if (cartItemKey(c) !== key) return c;
    if (c.source === 'filmcutting-order') return c; // qty 변경 불가
    return { ...c, qty: safeQty };
  });
}

// 합계 — 노출가 기준. 결제 시점의 진실 원천.
export function cartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}

// 원가 합계 — 취소선 표시할 때만 사용. 모든 항목에 original_price 가 있어야 의미 있음.
export function cartOriginalTotal(cart: CartItem[]): number {
  return cart.reduce((sum, c) => {
    const orig = c.source === 'post-package' ? (c.original_price ?? c.price) : c.price;
    return sum + orig * c.qty;
  }, 0);
}

// 카트 직렬화/역직렬화 — schema 가 바뀌면 v2 키로 마이그레이션.
export function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 가벼운 스키마 검증 — source 키 없으면 폐기.
    return parsed.filter((it) => it && typeof it === 'object' && 'source' in it) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // quota / private mode — silent fail.
  }
}
