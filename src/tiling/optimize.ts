import { bbox, pointInPolygon, swapXY } from '../geometry/polygon';
import type { Point, Rect, Ring } from '../geometry/types';
import { sliverLimits } from './classify';
import { computeLayout } from './engine';
import { pitch, rowShift } from './grid';
import type { LayoutResult, LayoutSpec, RoomCm, TileSpec } from './types';

const TOP_K = 20;
const AXIS_TOL = 1e-6;

/** Aresta de parede alinhada aos eixos, no referencial da paginação. */
export interface AxisEdge {
  /** Coordenada fixa (x de aresta vertical, y de aresta horizontal). */
  at: number;
  from: number;
  to: number;
  /** Interior do lado de coordenada menor (à esquerda / acima). */
  interiorLow: boolean;
}

export function axisEdges(rings: Ring[]): { v: AxisEdge[]; h: AxisEdge[] } {
  const v: AxisEdge[] = [];
  const h: AxisEdge[] = [];
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      if (Math.abs(a.x - b.x) < AXIS_TOL && Math.abs(a.y - b.y) > AXIS_TOL) {
        const mid = (a.y + b.y) / 2;
        v.push({ at: a.x, from: Math.min(a.y, b.y), to: Math.max(a.y, b.y), interiorLow: pointInPolygon({ x: a.x - 0.01, y: mid }, ring) });
      } else if (Math.abs(a.y - b.y) < AXIS_TOL && Math.abs(a.x - b.x) > AXIS_TOL) {
        const mid = (a.x + b.x) / 2;
        h.push({ at: a.y, from: Math.min(a.x, b.x), to: Math.max(a.x, b.x), interiorLow: pointInPolygon({ x: mid, y: a.y - 0.01 }, ring) });
      }
    }
  }
  return { v, h };
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Largura do recorte junto a uma parede em `t` (posição dentro do passo), ou null se a peça fica inteira. */
function cutAt(t: number, size: number, interiorLow: boolean): number | null {
  if (t <= AXIS_TOL || t >= size - AXIS_TOL) return null;
  return interiorLow ? t : size - t;
}

function frameRings(rooms: RoomCm[], layout: LayoutSpec): Ring[] {
  return rooms.map((r) => (layout.rotationDeg === 90 ? swapXY(r.ring) : r.ring));
}

function scoreFrame(edges: { v: AxisEdge[]; h: AxisEdge[] }, tile: TileSpec, layout: LayoutSpec, o: Point): number {
  const { L, W, px, py } = pitch(tile);
  const lim = sliverLimits(L, W, layout);
  let slivers = 0;
  let cuts = 0;
  for (const e of edges.v) {
    const rStart = Math.floor((e.from - o.y) / py);
    const rEnd = Math.ceil((e.to - o.y) / py);
    for (let r = rStart; r <= rEnd; r++) {
      const y0 = o.y + r * py;
      if (Math.min(y0 + W, e.to) - Math.max(y0, e.from) <= AXIS_TOL) continue;
      const cut = cutAt(mod(e.at - o.x - rowShift(r, layout, px), px), L, e.interiorLow);
      if (cut === null) continue;
      cuts++;
      if (cut < lim.x) slivers++;
    }
  }
  for (const e of edges.h) {
    const cut = cutAt(mod(e.at - o.y, py), W, e.interiorLow);
    if (cut === null) continue;
    const count = Math.max(1, Math.ceil((e.to - e.from) / px));
    cuts += count;
    if (cut < lim.y) slivers += count;
  }
  return 1000 * slivers + cuts;
}

const toFrame = (p: Point, layout: LayoutSpec): Point => (layout.rotationDeg === 90 ? { x: p.y, y: p.x } : p);

/** Pontuação rápida (só paredes alinhadas aos eixos) de uma origem no referencial da planta. */
export function fastScore(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec, origin: Point): number {
  return scoreFrame(axisEdges(frameRings(rooms, layout)), tile, layout, toFrame(origin, layout));
}

export function compareResults(a: LayoutResult, b: LayoutResult): number {
  return a.summary.slivers - b.summary.slivers || a.summary.newTiles - b.summary.newTiles || a.summary.cut - b.summary.cut;
}

/** Diferença entre os recortes de lados opostos da caixa envolvente (menor = mais centralizado). */
function centering(bounds: Rect, o: Point, tile: TileSpec): number {
  const { L, W, px, py } = pitch(tile);
  const edgeCut = (t: number, size: number, low: boolean) => cutAt(t, size, low) ?? size;
  const left = edgeCut(mod(bounds.x - o.x, px), L, false);
  const right = edgeCut(mod(bounds.x + bounds.w - o.x, px), L, true);
  const top = edgeCut(mod(bounds.y - o.y, py), W, false);
  const bottom = edgeCut(mod(bounds.y + bounds.h - o.y, py), W, true);
  return Math.abs(left - right) + Math.abs(top - bottom);
}

/** Escolhe a origem da grade: fase rápida em passos de 1 cm, fase exata nos melhores candidatos. */
export function optimizeOrigin(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec): Point {
  if (rooms.length === 0) return { x: 0, y: 0 };
  const rings = frameRings(rooms, layout);
  const bounds = bbox(rings);
  const edges = axisEdges(rings);
  const { px, py } = pitch(tile);

  const candidates: { o: Point; score: number }[] = [];
  for (let i = 0; i < px; i++) {
    for (let j = 0; j < py; j++) {
      const o = { x: bounds.x + i, y: bounds.y + j };
      candidates.push({ o, score: scoreFrame(edges, tile, layout, o) });
    }
  }
  candidates.sort((a, b) => a.score - b.score || centering(bounds, a.o, tile) - centering(bounds, b.o, tile));

  const exact = { ...layout, origin: 'auto' as const };
  let best: { o: Point; res: LayoutResult; center: number } | null = null;
  for (const { o } of candidates.slice(0, TOP_K)) {
    const plan = toFrame(o, layout);
    const origins = Object.fromEntries(rooms.map((r) => [r.id, plan]));
    const res = computeLayout(rooms, tile, exact, origins);
    const center = centering(bounds, o, tile);
    if (!best || compareResults(res, best.res) < 0 || (compareResults(res, best.res) === 0 && center < best.center)) {
      best = { o: plan, res, center };
    }
  }
  return best!.o;
}
