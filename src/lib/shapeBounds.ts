// 도형 외곽 박스 계산 — film-cutting의 src/utils/shapeBounds.js를 TS로 이식.
// SYNC: 위 JS 원본과 1:1 대응. 한쪽 로직을 바꾸면 반대쪽도 함께 수정할 것.
//
// paper-core를 명시 import하는 이유: paper 패키지의 자동 entry는 Node 환경에서
// `dist/node/canvas.js`를 가져오는데, 이게 jsdom을 require해서 Next.js 빌드가
// 깨진다. paper-core는 jsdom/canvas 의존성 없는 순수 벡터 연산 빌드라
// SSR 단계에서도 안전하게 import 가능.
import paper from 'paper/dist/paper-core';

export type ShapeData = {
  id?: string;
  type: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  pathData?: string;
  data?: string;
  width?: number;
  height?: number;
  cornerRadius?: number;
  radius?: number;
  numPoints?: number;
  outerRadius?: number;
  innerRadius?: number;
};

export type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// 도형 하나의 local bounds(원점 기준, scaleX/Y와 rotation 적용 후의 path 외곽 박스).
// shape.x/y는 더하지 않는다 — 호출처가 필요 시 world 좌표로 변환.
export function computeLocalBounds(shape: ShapeData): Bounds {
  const sx = shape.scaleX || 1;
  const sy = shape.scaleY || 1;
  const data = shape.pathData || shape.data;
  if (data) {
    if (!paper.project) paper.setup(new paper.Size(1, 1));
    const item = paper.PathItem.create(data);
    item.scale(sx, sy, new paper.Point(0, 0));
    if (shape.rotation) item.rotate(shape.rotation, new paper.Point(0, 0));
    const b = item.bounds;
    const out: Bounds = { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    item.remove();
    return out;
  }
  // pathData 없는 primitive 폴백 — 중심 정렬 단순 박스
  const w = (shape.width || (shape.radius || 0) * 2 || 100) * sx;
  const h = (shape.height || (shape.radius || 0) * 2 || 100) * sy;
  return { left: -w / 2, right: w / 2, top: -h / 2, bottom: h / 2 };
}

// 각 도형의 외곽 박스 크기(mm). FilmCutting OrderLookupPage의 computeShapeSizes와
// 1:1 동일 — computeLocalBounds(paper 기반)라 pathData·회전·반전(음수 scale)을
// 모두 정확히 반영하고, 박스는 항상 양수라 별도 보정이 필요 없다.
export function computeShapeSizes(
  shapes: ShapeData[] | null | undefined,
): { w: number; h: number }[] {
  if (!Array.isArray(shapes)) return [];
  return shapes.map((s) => {
    const b = computeLocalBounds(s);
    return { w: Math.round(b.right - b.left), h: Math.round(b.bottom - b.top) };
  });
}

// 여러 도형의 world bounds union — 각 shape local bounds에 x/y offset 더해
// 4면 min/max로 합침. 비거나 모두 실패면 null.
export function computeUnionBounds(shapes: ShapeData[] | null | undefined): Bounds | null {
  if (!Array.isArray(shapes) || shapes.length === 0) return null;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  let found = false;
  for (const shape of shapes) {
    const b = computeLocalBounds(shape);
    if (!b) continue;
    const x = shape.x || 0;
    const y = shape.y || 0;
    left = Math.min(left, x + b.left);
    right = Math.max(right, x + b.right);
    top = Math.min(top, y + b.top);
    bottom = Math.max(bottom, y + b.bottom);
    found = true;
  }
  if (!found) return null;
  return { left, right, top, bottom };
}
