import { bbox, pointInPolygon, swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { computeLayout } from './engine';
import { pitch, rowShift } from './grid';
import type { LayoutSpec, Piece, RoomCm, TileSpec } from './types';

/** Distância máxima para "encostar" a primeira fileira na parede clicada. */
export const START_SNAP_CM = 60;

interface NearWall {
  /** Parede de y constante (no referencial da paginação). */
  horizontal: boolean;
  at: number;
  /** Interior do lado de coordenada menor (acima / à esquerda). */
  interiorLow: boolean;
  dist: number;
}

function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Parede reta mais próxima de `p` a até START_SNAP_CM; `horizontal` filtra a direção. */
function nearestWall(rings: Point[][], p: Point, onlyHorizontal?: boolean): NearWall | null {
  let best: NearWall | null = null;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const horizontal = Math.abs(a.y - b.y) < 1e-6;
      const vertical = Math.abs(a.x - b.x) < 1e-6;
      if (!horizontal && !vertical) continue;
      if (onlyHorizontal !== undefined && horizontal !== onlyHorizontal) continue;
      const dist = segDist(p, a, b);
      if (dist > START_SNAP_CM || (best && dist >= best.dist)) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const low = horizontal ? { x: mid.x, y: mid.y - 0.5 } : { x: mid.x - 0.5, y: mid.y };
      best = { horizontal, at: horizontal ? a.y : a.x, interiorLow: pointInPolygon(low, ring), dist };
    }
  }
  return best;
}

/**
 * Origem da grade para a peça sob o ponto `p` (referencial da planta), ex.: a da porta, ficar
 * inteira. Perto de uma parede, a fileira encosta nela. A peça fica centralizada no toque; só sai
 * do centro (sem deixar de cobrir o ponto) ou encosta na parede do lado se o centro deixaria filete.
 */
export function startOrigin(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec, p: Point): Point {
  const swap = layout.rotationDeg === 90;
  const flip = (q: Point): Point => (swap ? { x: q.y, y: q.x } : q);
  const pf = flip(p);
  const rings = rooms.map((r) => (swap ? swapXY(r.ring) : r.ring));
  const { L, W, px, py } = pitch(tile);
  const shiftAt = (oy: number) => rowShift(Math.floor((pf.y - oy) / py), layout, px);
  const aligned = (w: NearWall, size: number) => (w.interiorLow ? w.at - size : w.at);
  // início da peça que cobre `c`: centralizada primeiro, depois a parede do lado, depois mais para cada ponta
  const options = (c: number, size: number, side: NearWall | null) => [
    c - size / 2,
    ...(side ? [aligned(side, size)] : []),
    c - size * 0.85,
    c - size * 0.15,
  ];

  const nearest = nearestWall(rings, pf);
  const ys = nearest?.horizontal ? [aligned(nearest, W)] : options(pf.y, W, nearestWall(rings, pf, true));
  const xs = nearest && !nearest.horizontal ? [aligned(nearest, L)] : options(pf.x, L, nearestWall(rings, pf, false));
  const candidates = ys.flatMap((oy) => xs.map((tx) => flip({ x: tx - shiftAt(oy), y: oy })));
  if (candidates.length === 1) return candidates[0];

  // a peça da entrada precisa sair inteira (perto de um canto, algumas opções atravessariam a
  // parede); entre as que deixam, a primeira sem filete ou a com menos, na ordem de preferência
  let best = candidates[0];
  let bestScore = Infinity;
  for (const o of candidates) {
    const res = computeLayout(rooms, tile, { ...layout, origin: o }, Object.fromEntries(rooms.map((r) => [r.id, o])));
    const score = (entrancePiece(res, p)?.kind === 'full' ? 0 : 10_000) + res.summary.slivers;
    if (score < bestScore) {
      best = o;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return best;
}

/** Pontos de entrada marcados: o da grade contínua ou os de cada cômodo. */
export function entrancePoints(layout: LayoutSpec, rooms: RoomCm[]): Point[] {
  if (layout.gridMode === 'global') return layout.start ? [layout.start] : [];
  return rooms.flatMap((r) => (r.start ? [r.start] : []));
}

/** Peça da entrada: a que cobre o ponto tocado ou, se o toque foi na soleira, a mais perto dele. */
export function entrancePiece(result: { pieces: Piece[] }, p: Point): Piece | undefined {
  const live = result.pieces.filter((q) => !q.removed);
  const inside = live.find((q) => q.shape.some((r) => pointInPolygon(p, r)));
  if (inside) return inside;
  let best: Piece | undefined;
  let bestD = START_SNAP_CM;
  for (const q of live) {
    const b = bbox(q.shape);
    const d = Math.hypot(Math.max(b.x - p.x, 0, p.x - b.x - b.w), Math.max(b.y - p.y, 0, p.y - b.y - b.h));
    if (d < bestD) {
      best = q;
      bestD = d;
    }
  }
  return best;
}
