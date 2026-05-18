// 주문 도면 SVG 썸네일 — film-cutting의 OrderThumbnail.jsx를 TS로 이식.
//
// 7가지 shape 타입(parametric/path/rect/circle/triangle/star/bubble)을 SVG
// primitive로 매핑. Konva의 적용 순서(translate → rotate → scale)와 origin
// 규칙을 그대로 재현해 film-cutting의 OrderLookupPage와 시각 결과 1:1.
'use client';

import { useMemo } from 'react';
import { computeUnionBounds, type ShapeData } from '@/lib/shapeBounds';

// DrawingCanvas의 SpeechBubblePath와 동일한 legacy 상수.
const SPEECH_BUBBLE_PATH = 'M0 0 H 100 V 70 H 20 L 0 100 L 0 70 V 0 Z';

function renderShape(shape: ShapeData, key: string) {
  const common = {
    fill: 'currentColor',
    stroke: '#000',
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (shape.type) {
    case 'parametric':
      return <path key={key} d={shape.pathData} fillRule="evenodd" {...common} />;
    case 'path':
      return <path key={key} d={shape.data} fillRule="evenodd" {...common} />;
    case 'rect':
      return (
        <rect
          key={key}
          x={0}
          y={0}
          width={shape.width || 0}
          height={shape.height || 0}
          rx={shape.cornerRadius || 0}
          {...common}
        />
      );
    case 'circle':
      return <circle key={key} cx={0} cy={0} r={shape.radius || 0} {...common} />;
    case 'triangle': {
      const r = shape.radius || 0;
      const pts: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
      }
      return <polygon key={key} points={pts.join(' ')} {...common} />;
    }
    case 'star': {
      const n = shape.numPoints || 5;
      const ro = shape.outerRadius || 0;
      const ri = shape.innerRadius || 0;
      const pts: string[] = [];
      for (let i = 0; i < n * 2; i += 1) {
        const r = i % 2 === 0 ? ro : ri;
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
      }
      return <polygon key={key} points={pts.join(' ')} {...common} />;
    }
    case 'bubble':
      return <path key={key} d={SPEECH_BUBBLE_PATH} {...common} />;
    default:
      return null;
  }
}

export default function OrderThumbnail({
  shapes,
  filmColor = '#e2e8f0',
  size = 64,
}: {
  shapes: ShapeData[] | null | undefined;
  filmColor?: string;
  size?: number;
}) {
  const bounds = useMemo(() => computeUnionBounds(shapes), [shapes]);

  if (!shapes || !Array.isArray(shapes) || shapes.length === 0 || !bounds) {
    return (
      <div
        className="flex items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-[9px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600"
        style={{ width: size, height: size }}
        aria-label="도면 없음"
      >
        없음
      </div>
    );
  }

  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const safeW = w > 0 ? w : 1;
  const safeH = h > 0 ? h : 1;
  const pad = Math.max(safeW, safeH) * 0.15;
  const viewBox = `${bounds.left - pad} ${bounds.top - pad} ${safeW + 2 * pad} ${safeH + 2 * pad}`;

  return (
    <div
      className="flex-none rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      style={{ width: size, height: size, color: filmColor }}
      aria-label="도면 미리보기"
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
      >
        {/* 배경에 필름 색을 옅게 깔아 색상 맥락 제공 */}
        <rect
          x={bounds.left - pad}
          y={bounds.top - pad}
          width={safeW + 2 * pad}
          height={safeH + 2 * pad}
          fill={filmColor}
          opacity={0.15}
        />
        {shapes.map((shape, i) => {
          const tx = shape.x || 0;
          const ty = shape.y || 0;
          const rot = shape.rotation || 0;
          const sx = shape.scaleX || 1;
          const sy = shape.scaleY || 1;
          // Konva 적용 순서: translate → rotate → scale.
          const transform = `translate(${tx} ${ty}) rotate(${rot}) scale(${sx} ${sy})`;
          return (
            <g key={shape.id || i} transform={transform}>
              {renderShape(shape, `s-${i}`)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
