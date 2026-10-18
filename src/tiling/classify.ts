import { bbox, isAxisRect, polygonArea } from '../geometry/polygon';
import type { Rect, Ring } from '../geometry/types';
import type { LayoutSpec, Piece } from './types';

/** Tolerância para considerar um lado reduzido (0,5 mm). */
const SIDE_TOL = 0.05;

export function sliverLimits(L: number, W: number, layout: LayoutSpec) {
  return {
    x: Math.max(layout.minCutCm, layout.minCutFraction * L),
    y: Math.max(layout.minCutCm, layout.minCutFraction * W),
  };
}

/** Classifica a parte de uma peça que fica no cômodo (referencial da paginação). */
export function classify(
  shape: Ring[],
  rect: Rect,
  L: number,
  W: number,
  layout: LayoutSpec,
): Pick<Piece, 'kind' | 'cutType' | 'cutSize'> {
  const area = shape.reduce((s, r) => s + polygonArea(r), 0);
  if (area >= 0.995 * rect.w * rect.h) return { kind: 'full' };

  const b = bbox(shape);
  const reducedX = b.w < L - SIDE_TOL;
  const reducedY = b.h < W - SIDE_TOL;
  const isRect = shape.length === 1 && isAxisRect(shape[0]);
  const cutType = !isRect ? 'shaped' : reducedX && reducedY ? 'corner' : 'straight';

  const lim = sliverLimits(L, W, layout);
  const sliver = (reducedX && b.w < lim.x) || (reducedY && b.h < lim.y);
  return { kind: sliver ? 'sliver' : 'cut', cutType, cutSize: { w: b.w, h: b.h } };
}
