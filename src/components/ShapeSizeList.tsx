// 주문 도형별 크기(mm) 목록 — FilmCutting 주문조회와 동일한 computeShapeSizes 사용.
//
// computeShapeSizes는 paper-core 의존(computeLocalBounds) → SSR 빌드에서 jsdom을
// 끌어와 깨진다. 그래서 이 컴포넌트는 반드시 `ssr: false` dynamic으로만 로드한다
// (OrderThumbnail과 동일한 격리 패턴).
'use client';

import { computeShapeSizes, type ShapeData } from '@/lib/shapeBounds';

export default function ShapeSizeList({ shapes }: { shapes: ShapeData[] | null | undefined }) {
  const sizes = computeShapeSizes(shapes);
  if (sizes.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-ink-60">
      <span className="text-ink-45">사이즈</span>
      {sizes.map((sz, i) => (
        <span
          key={i}
          className="rounded border border-card-line bg-bg px-1.5 py-0.5 tabular-nums"
        >
          {sz.w} × {sz.h} mm
        </span>
      ))}
    </div>
  );
}
