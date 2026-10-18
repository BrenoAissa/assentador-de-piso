import { sliverLimits } from './classify';
import type { LayoutSpec, Piece } from './types';

const SIDE_TOL = 0.05;

interface Leftover {
  axis: 'x' | 'y';
  len: number;
  from: number;
}

/**
 * Reaproveitamento guloso de sobras (referencial da paginação).
 * Só recortes retos participam; cada sobra tem um lado de fábrica e é usada uma vez só.
 */
export function assignLeftovers(pieces: Piece[], L: number, W: number, layout: LayoutSpec): void {
  const lim = sliverLimits(L, W, layout);
  const cuts = pieces
    .filter((p) => p.kind !== 'full' && p.cutType === 'straight' && p.cutSize)
    .map((p) => {
      const axis: 'x' | 'y' = p.cutSize!.w < L - SIDE_TOL ? 'x' : 'y';
      return { p, axis, need: axis === 'x' ? p.cutSize!.w : p.cutSize!.h };
    })
    .sort((a, b) => b.need - a.need || a.p.n - b.p.n);

  const stock: Leftover[] = [];
  for (const { p, axis, need } of cuts) {
    let best = -1;
    for (let i = 0; i < stock.length; i++) {
      const s = stock[i];
      if (s.axis === axis && s.len >= need && (best < 0 || s.len < stock[best].len)) best = i;
    }
    if (best >= 0) {
      p.fromLeftoverOf = stock[best].from;
      stock.splice(best, 1);
      continue;
    }
    const full = axis === 'x' ? L : W;
    const len = full - need - layout.kerfCm;
    if (len >= (axis === 'x' ? lim.x : lim.y)) stock.push({ axis, len, from: p.n });
  }
}
