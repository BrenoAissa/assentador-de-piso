import type { Point, Rect } from '../geometry/types';
import type { LayoutSpec, TileSpec } from './types';

/**
 * Medidas no referencial da paginação: comprimento da peça (L) em x, largura (W) em y.
 * `px`/`py` são os passos da grade, com o rejunte incluído.
 */
export function pitch(tile: TileSpec) {
  const L = tile.lengthCm;
  const W = tile.widthCm;
  const joint = tile.jointMm / 10;
  return { L, W, joint, px: L + joint, py: W + joint };
}

/** Deslocamento em x da fileira `r`, sempre em [0, px). */
export function rowShift(r: number, layout: LayoutSpec, px: number): number {
  if (layout.pattern === 'straight') return 0;
  const { kind, value } = layout.runningOffset;
  const d = kind === 'fraction' ? value * px : value;
  let s = ((r * d) % px + px) % px;
  if (px - s < 1e-7 || s < 1e-7) s = 0;
  return s;
}

export interface TileSlot {
  r: number;
  c: number;
  rect: Rect;
}

/**
 * Retângulos das peças inteiras que tocam `bounds`, em ordem de fileira e depois de posição.
 * `extraShift(r)` desliza uma fileira além do padrão (ajuste manual).
 */
export function tileRects(
  bounds: Rect,
  origin: Point,
  tile: TileSpec,
  layout: LayoutSpec,
  extraShift: (r: number) => number = () => 0,
): TileSlot[] {
  const { L, W, px, py } = pitch(tile);
  const out: TileSlot[] = [];
  const x1 = bounds.x + bounds.w;
  const y1 = bounds.y + bounds.h;
  const rStart = Math.floor((bounds.y - origin.y) / py) - 1;
  const rEnd = Math.ceil((y1 - origin.y) / py);
  for (let r = rStart; r <= rEnd; r++) {
    const y = origin.y + r * py;
    if (y + W <= bounds.y || y >= y1) continue;
    const s = rowShift(r, layout, px) + extraShift(r);
    const cStart = Math.floor((bounds.x - origin.x - s) / px) - 1;
    const cEnd = Math.ceil((x1 - origin.x - s) / px);
    for (let c = cStart; c <= cEnd; c++) {
      const x = origin.x + s + c * px;
      if (x + L <= bounds.x || x >= x1) continue;
      out.push({ r, c, rect: { x, y, w: L, h: W } });
    }
  }
  return out;
}
