import { swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { pitch, rowShift } from './grid';
import { axisEdges, type AxisEdge } from './optimize';
import type { LayoutSpec, RoomCm, TileSpec } from './types';

/** Trecho de parede (referencial da planta) onde as peças ficaram encostadas. */
export interface WallGuide {
  a: Point;
  b: Point;
}

const ALIGNED = 0.5;
const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Ajuste mínimo (pode ser negativo) para `value` cair num valor ≡ `target` (mod `period`). */
function adjustTo(value: number, target: number, period: number): number {
  const d = mod(target - value, period);
  return d > period / 2 ? d - period : d;
}

const frameOf = (layout: LayoutSpec) => {
  const swap = layout.rotationDeg === 90;
  return { swap, flip: (p: Point): Point => (swap ? { x: p.y, y: p.x } : p) };
};

/** Origem (ox) que encosta uma peça na parede vertical `e`, na fileira de deslocamento `shift`. */
const targetX = (e: AxisEdge, L: number, shift: number) => (e.interiorLow ? e.at - L : e.at) - shift;
/** Origem (oy) que encosta uma fileira na parede horizontal `e`. */
const targetY = (e: AxisEdge, W: number) => (e.interiorLow ? e.at - W : e.at);

function guide(e: AxisEdge, vertical: boolean, flip: (p: Point) => Point): WallGuide {
  const a = vertical ? { x: e.at, y: e.from } : { x: e.from, y: e.at };
  const b = vertical ? { x: e.at, y: e.to } : { x: e.to, y: e.at };
  return { a: flip(a), b: flip(b) };
}

/**
 * Ímã do piso inteiro: ajusta o arraste para a borda das peças encostar na face de uma parede
 * quando está a menos de `tolCm`. Devolve o arraste ajustado e as paredes onde as peças
 * ficaram encostadas (para acender na tela).
 */
export function floorSnap(
  rooms: RoomCm[],
  tile: TileSpec,
  layout: LayoutSpec,
  base: Point,
  delta: Point,
  tolCm: number,
): { delta: Point; guides: WallGuide[] } {
  const { flip } = frameOf(layout);
  const edges = axisEdges(rooms.map((r) => (layout.rotationDeg === 90 ? swapXY(r.ring) : r.ring)));
  const { L, W, px, py } = pitch(tile);
  const o = flip({ x: base.x + delta.x, y: base.y + delta.y });

  let dy: number | null = null;
  for (const e of edges.h) {
    const adj = adjustTo(o.y, targetY(e, W), py);
    if (Math.abs(adj) <= tolCm && (dy === null || Math.abs(adj) < Math.abs(dy))) dy = adj;
  }
  const oy = o.y + (dy ?? 0);
  const shiftAt = (e: AxisEdge) => rowShift(Math.floor(((e.from + e.to) / 2 - oy) / py), layout, px);
  let dx: number | null = null;
  for (const e of edges.v) {
    const adj = adjustTo(o.x, targetX(e, L, shiftAt(e)), px);
    if (Math.abs(adj) <= tolCm && (dx === null || Math.abs(adj) < Math.abs(dx))) dx = adj;
  }
  const ox = o.x + (dx ?? 0);

  const guides: WallGuide[] = [
    ...edges.h.filter((e) => Math.abs(adjustTo(oy, targetY(e, W), py)) < ALIGNED).map((e) => guide(e, false, flip)),
    ...edges.v.filter((e) => Math.abs(adjustTo(ox, targetX(e, L, shiftAt(e)), px)) < ALIGNED).map((e) => guide(e, true, flip)),
  ];
  const plan = flip({ x: ox, y: oy });
  return { delta: { x: plan.x - base.x, y: plan.y - base.y }, guides };
}

/**
 * Ímã de uma fileira: ajusta o deslize extra (`extra`, cm ao longo da fileira) para a ponta da
 * fileira encostar numa parede do cômodo que a fileira atravessa.
 */
export function rowSnap(
  room: RoomCm,
  tile: TileSpec,
  layout: LayoutSpec,
  origin: Point,
  row: number,
  extra: number,
  tolCm: number,
): { extra: number; guides: WallGuide[] } {
  const { flip } = frameOf(layout);
  const { v } = axisEdges([layout.rotationDeg === 90 ? swapXY(room.ring) : room.ring]);
  const { L, W, px, py } = pitch(tile);
  const o = flip(origin);
  const y0 = o.y + row * py;
  const crossing = v.filter((e) => Math.min(e.to, y0 + W) - Math.max(e.from, y0) > ALIGNED);
  const base = o.x + rowShift(row, layout, px);

  let adj: number | null = null;
  for (const e of crossing) {
    const a = adjustTo(base + extra, targetX(e, L, 0), px);
    if (Math.abs(a) <= tolCm && (adj === null || Math.abs(a) < Math.abs(adj))) adj = a;
  }
  const next = extra + (adj ?? 0);
  const guides = crossing
    .filter((e) => Math.abs(adjustTo(base + next, targetX(e, L, 0), px)) < ALIGNED)
    .map((e) => {
      // só o trecho da parede na altura da fileira
      const from = Math.max(e.from, y0);
      const to = Math.min(e.to, y0 + W);
      return guide({ ...e, from, to }, true, flip);
    });
  return { extra: next, guides };
}
