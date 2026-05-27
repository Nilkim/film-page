// 카트 Context — 클라이언트 전역 상태.
//
// 책임:
//   - mount 시 localStorage 에서 로드 → hydrate
//   - 상태 변경 시 localStorage 와 자동 동기화
//   - 같은 도메인 다른 탭에서 카트 변경 시 storage 이벤트로 합류
//
// SSR 안전성: useEffect 안에서만 window 접근. 초기 state 는 항상 [] 로 시작.
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type CartItem,
  CART_STORAGE_KEY,
  addToCart,
  cartItemKey,
  cartSubtotal,
  cartOriginalTotal,
  loadCart,
  removeFromCart,
  saveCart,
  setItemQty,
} from '@/lib/cart';

type CartContextValue = {
  cart: CartItem[];
  ready: boolean;            // localStorage 로드 완료 플래그(SSR hydration 후 true)
  count: number;             // 총 아이템 개수(qty 합산)
  subtotal: number;
  originalTotal: number;
  add: (item: CartItem) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // 1. mount 시 localStorage 로드.
  useEffect(() => {
    setCart(loadCart());
    setReady(true);
  }, []);

  // 2. cart 변경마다 localStorage 저장.
  useEffect(() => {
    if (!ready) return;
    saveCart(cart);
  }, [cart, ready]);

  // 3. 다른 탭 동기화 — storage 이벤트.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== CART_STORAGE_KEY) return;
      setCart(loadCart());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((item: CartItem) => {
    setCart((prev) => addToCart(prev, item));
  }, []);

  const remove = useCallback((key: string) => {
    setCart((prev) => removeFromCart(prev, key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setCart((prev) => setItemQty(prev, key, qty));
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const count = cart.reduce((s, it) => s + it.qty, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        ready,
        count,
        subtotal: cartSubtotal(cart),
        originalTotal: cartOriginalTotal(cart),
        add,
        remove,
        setQty,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const v = useContext(CartContext);
  if (!v) throw new Error('useCart must be used inside <CartProvider>');
  return v;
}

// 아이템 key 헬퍼 export — 외부에서도 사용.
export { cartItemKey };
