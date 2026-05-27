// 상세 페이지 상단 "주문 패키지" 영역 — FilmArtwork 라이트 디자인.
//
// 검은 배경 제거(ivory/ink 카드). 묶인 주문 칩을 클릭하면 해당 주문의 상세
// (도형 썸네일 + 필름 이름/색 + 도형 사이즈)를 아래에 펼쳐 보여준다.
//
// Client Component — 칩 토글 상태 + paper.js 썸네일(ssr 불가) 때문.
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ShapeData } from '@/lib/shapeBounds';
import PriceTag from '@/components/PriceTag';
import AddToCartButton from '@/components/AddToCartButton';

// OrderThumbnail / ShapeSizeList 모두 paper.js 의존 → SSR에서 깨짐. 클라이언트에서만 로드.
const OrderThumbnail = dynamic(() => import('@/components/OrderThumbnail'), {
  ssr: false,
  loading: () => (
    <div className="flex-none rounded border border-card-line bg-ink-06" style={{ width: 72, height: 72 }} />
  ),
});
const ShapeSizeList = dynamic(() => import('@/components/ShapeSizeList'), { ssr: false });

// 코틸레돈 네이버 스마트스토어 — 주문 패키지 박스 우하단 구매 링크.
const SMARTSTORE_URL = 'https://smartstore.naver.com/cotyledon/products/13553995545';

export type OrderDetail = {
  code: string;
  shapes_json: ShapeData[] | null;
  film_name: string | null;
  film_color: string | null;
};

export default function OrderPackagePanel({
  packageCode,
  details,
  totalPrice = 0,
  originalPrice = 0,
  hasDiscount = false,
  postId,
  postTitle,
  thumb,
}: {
  packageCode: string;
  details: OrderDetail[];
  // 노출가(할인 적용 후). 0 이면 가격 미표시.
  totalPrice?: number;
  // 원가(취소선용). 할인 없으면 totalPrice 와 동일.
  originalPrice?: number;
  // 두 값이 다르면 true — 취소선 렌더.
  hasDiscount?: boolean;
  // 카트 담기용 식별자/표시명.
  postId?: string;
  postTitle?: string;
  thumb?: string | null;
}) {
  // 선택된 주문 코드(단일). 같은 칩 다시 누르면 닫힘.
  const [openCode, setOpenCode] = useState<string | null>(null);
  const open = details.find((d) => d.code === openCode) ?? null;

  return (
    <div className="rounded-[6px] border border-card-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-45">주문 패키지</div>
        {details.length > 0 && (
          <div className="text-[11px] text-ink-45">{details.length}건 묶음</div>
        )}
      </div>
      <div className="mt-0.5 text-lg font-bold tracking-[-0.01em] text-ink">
        {packageCode || '—'}
      </div>
      {totalPrice > 0 && (
        <PriceTag
          className="mt-0.5"
          label="패키지 가격"
          displayPrice={totalPrice}
          originalPrice={originalPrice || totalPrice}
          hasDiscount={hasDiscount}
          size="lg"
        />
      )}

      {details.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {details.map((d) => {
            const active = d.code === openCode;
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => setOpenCode(active ? null : d.code)}
                aria-expanded={active}
                className={
                  'rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium transition-colors duration-150 ' +
                  (active
                    ? 'border-ink bg-ink text-bg'
                    : 'border-card-line bg-ink-06 text-ink-60 hover:border-ink-60 hover:text-ink')
                }
              >
                {d.code}
              </button>
            );
          })}
        </div>
      )}

      {/* 선택된 주문 상세 — 칩 클릭 시 펼침 */}
      {open && (
        <div className="mt-3 flex items-center gap-3 rounded-[6px] border border-card-line bg-bg p-3">
          <OrderThumbnail
            shapes={open.shapes_json}
            filmColor={open.film_color ?? '#e2e8f0'}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm font-semibold text-ink">{open.code}</div>
            {open.film_name ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-60">
                {open.film_color && (
                  <span
                    className="inline-block size-3 flex-none rounded-full border border-card-line"
                    style={{ background: open.film_color }}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{open.film_name}</span>
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-ink-45">상세 정보를 가져오지 못했어요.</div>
            )}
            <ShapeSizeList shapes={open.shapes_json} />
          </div>
        </div>
      )}

      {/* 결제 CTA — film-artwork 자체 카트 + 레거시 네이버쇼핑 옵션 */}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {postId && postTitle && totalPrice > 0 && (
          <AddToCartButton
            packageCode={packageCode}
            postId={postId}
            title={postTitle}
            thumb={thumb}
            price={totalPrice}
            originalPrice={originalPrice || totalPrice}
            size="lg"
          />
        )}
        <a
          href={SMARTSTORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#03C75A] px-3 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
          aria-label="네이버쇼핑에서 구매"
        >
          <span className="grid size-4 place-items-center rounded-[3px] bg-white text-[10px] font-extrabold leading-none text-[#03C75A]">
            N
          </span>
          네이버쇼핑
        </a>
      </div>
    </div>
  );
}
