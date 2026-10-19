import { pointInPolygon, swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { computeLayout } from './engine';
import { pitch, rowShift } from './grid';
import { compareResults } from './optimize';
import type { LayoutSpec, RoomCm, TileSpec } from './types';

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

function nearestWall(rings: Point[][], p: Point): NearWall | null {
  let best: NearWall | null = null;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const horizontal = Math.abs(a.y - b.y) < 1e-6;
      const vertical = Math.abs(a.x - b.x) < 1e-6;
      if (!horizontal && !vertical) continue;
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
 * Origem da grade para o piso "começar" no ponto `p` (referencial da planta), ex.: a porta.
 * Perto de uma parede, a fileira encosta nela com peça inteira; ao longo da parede, peça ou junta
 * centralizada no ponto — fica a que der menos filetes. Longe de paredes, peça centralizada.
 */
export function startOrigin(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec, p: Point): Point {
  const swap = layout.rotationDeg === 90;
  const flip = (q: Point): Point => (swap ? { x: q.y, y: q.x } : q);
  const pf = flip(p);
  const rings = rooms.map((r) => (swap ? swapXY(r.ring) : r.ring));
  const { L, W, joint, px, py } = pitch(tile);
  const shiftAt = (oy: number) => rowShift(Math.floor((pf.y - oy) / py), layout, px);
  // ox para peça (ou junta) centralizada em pf.x na fileira que contém pf
  const centeredX = (oy: number, jointCentered: boolean) =>
    (jointCentered ? pf.x - L - joint / 2 : pf.x - L / 2) - shiftAt(oy);
  const centeredY = (jointCentered: boolean) => (jointCentered ? pf.y - W - joint / 2 : pf.y - W / 2);

  const wall = nearestWall(rings, pf);
  const candidates: Point[] = [];
  if (!wall) {
    const oy = centeredY(false);
    candidates.push({ x: centeredX(oy, false), y: oy });
  } else if (wall.horizontal) {
    const oy = wall.interiorLow ? wall.at - W : wall.at;
    for (const jc of [false, true]) candidates.push({ x: centeredX(oy, jc), y: oy });
  } else {
    for (const jc of [false, true]) {
      const oy = centeredY(jc);
      const s = shiftAt(oy);
      candidates.push({ x: (wall.interiorLow ? wall.at - L : wall.at) - s, y: oy });
    }
  }

  const plan = candidates.map(flip);
  if (plan.length === 1) return plan[0];
  let best = plan[0];
  let bestRes = computeLayout(rooms, tile, { ...layout, origin: best }, Object.fromEntries(rooms.map((r) => [r.id, best])));
  for (const o of plan.slice(1)) {
    const res = computeLayout(rooms, tile, { ...layout, origin: o }, Object.fromEntries(rooms.map((r) => [r.id, o])));
    if (compareResults(res, bestRes) < 0) {
      best = o;
      bestRes = res;
    }
  }
  return best;
}
