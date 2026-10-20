import { bbox } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';

/** Abaixo desta inclinação (graus), a parede trava no eixo mais próximo. */
export const ORTHO_TOL_DEG = 10;
const SAME = 0.5;

/** Leva `to` para o eixo (0/90/180/270°) mais próximo de `from`, mantendo a distância. */
export function snapAngle(from: Point, to: Point, enabled = true): Point {
  if (!enabled) return to;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return to;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const nearest = Math.round(ang / 90) * 90;
  if (Math.abs(ang - nearest) > ORTHO_TOL_DEG) return to;
  const rad = (nearest * Math.PI) / 180;
  return { x: from.x + Math.round(Math.cos(rad)) * len, y: from.y + Math.round(Math.sin(rad)) * len };
}

/** Ponto a `dist` de `from`, na direção de `toward` (para a direita se não houver direção). */
export function pointAtDistance(from: Point, toward: Point, dist: number): Point {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: from.x + dist, y: from.y };
  return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
}

export function snapToGrid(p: Point, step: number): Point {
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

export function edgeLengths(ring: Ring): number[] {
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
}

/**
 * Muda o comprimento da parede `i` (de ring[i] para ring[i+1]).
 * Parede reta (horizontal/vertical): a linha de parede onde ela termina anda inteira, como
 * mover uma parede na obra; num retângulo, a parede oposta acompanha. Parede inclinada: só a
 * ponta final anda, na direção da parede.
 */
export function setEdgeLength(ring: Ring, i: number, length: number): Ring {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  const cur = Math.hypot(b.x - a.x, b.y - a.y);
  if (cur === 0 || !(length > 0)) return ring;
  const delta = length - cur;
  if (Math.abs(a.y - b.y) < SAME) {
    const s = Math.sign(b.x - a.x);
    return ring.map((p) => (Math.abs(p.x - b.x) < SAME ? { x: p.x + s * delta, y: p.y } : p));
  }
  if (Math.abs(a.x - b.x) < SAME) {
    const s = Math.sign(b.y - a.y);
    return ring.map((p) => (Math.abs(p.y - b.y) < SAME ? { x: p.x, y: p.y + s * delta } : p));
  }
  const ux = (b.x - a.x) / cur;
  const uy = (b.y - a.y) / cur;
  return ring.map((p, j) => (j === (i + 1) % ring.length ? { x: b.x + ux * delta, y: b.y + uy * delta } : p));
}

export function rectRing(x: number, y: number, w: number, h: number): Ring {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function translateRing(ring: Ring, dx: number, dy: number): Ring {
  return ring.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Canto superior esquerdo para um cômodo novo: à direita dos existentes, deixando a parede. */
export function placeBeside(rings: Ring[], gap: number): Point {
  if (rings.length === 0) return { x: 0, y: 0 };
  const b = bbox(rings);
  return { x: b.x + b.w + gap, y: b.y };
}

/**
 * Ajusta o arraste de um cômodo para encaixar nos vizinhos: bordas alinhadas, encostadas ou
 * separadas exatamente pela espessura da parede (`gap`), quando estão a menos de `tol`.
 */
export function snapMove(ring: Ring, others: Ring[], delta: Point, gap: number, tol: number): Point {
  const b = bbox(ring);
  const moved = { x0: b.x + delta.x, x1: b.x + b.w + delta.x, y0: b.y + delta.y, y1: b.y + b.h + delta.y };
  let bestX: number | null = null;
  let bestY: number | null = null;
  const consider = (cur: number | null, edge: number, target: number) => {
    const adj = target - edge;
    return Math.abs(adj) <= tol && (cur === null || Math.abs(adj) < Math.abs(cur)) ? adj : cur;
  };
  for (const o of others.map((r) => bbox(r))) {
    const ox0 = o.x;
    const ox1 = o.x + o.w;
    const oy0 = o.y;
    const oy1 = o.y + o.h;
    for (const t of [ox0, ox1, ox1 + gap]) bestX = consider(bestX, moved.x0, t);
    for (const t of [ox1, ox0, ox0 - gap]) bestX = consider(bestX, moved.x1, t);
    for (const t of [oy0, oy1, oy1 + gap]) bestY = consider(bestY, moved.y0, t);
    for (const t of [oy1, oy0, oy0 - gap]) bestY = consider(bestY, moved.y1, t);
  }
  return { x: delta.x + (bestX ?? 0), y: delta.y + (bestY ?? 0) };
}

export interface Guide {
  a: Point;
  b: Point;
}

export interface GeoSnap {
  point: Point;
  /** vertex: conectou num canto; edge: encostou numa parede; align: alinhou com um canto (guia). */
  kind: 'vertex' | 'edge' | 'align' | null;
  guides: Guide[];
}

function nearestOnEdges(p: Point, rings: Ring[]): { point: Point; dist: number } | null {
  let best: { point: Point; dist: number } | null = null;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      const q = { x: a.x + t * dx, y: a.y + t * dy };
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      if (!best || dist < best.dist) best = { point: q, dist };
    }
  }
  return best;
}

/**
 * Ímã do desenho, na ordem: conectar num canto (de outro cômodo ou do próprio desenho),
 * encostar numa parede, alinhar com um canto (com guia). `lock` diz qual coordenada pode
 * mudar quando a parede já está travada num eixo ('x' = parede horizontal, só o x anda).
 */
export function snapToGeometry(p: Point, rings: Ring[], extra: Point[], tol: number, lock?: 'x' | 'y'): GeoSnap {
  const verts = [...rings.flat(), ...extra];
  if (!lock) {
    let best: Point | null = null;
    let bestD = tol;
    for (const v of verts) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d <= bestD) {
        best = v;
        bestD = d;
      }
    }
    if (best) return { point: { x: best.x, y: best.y }, kind: 'vertex', guides: [] };
    const edge = nearestOnEdges(p, rings);
    if (edge && edge.dist <= tol) return { point: edge.point, kind: 'edge', guides: [] };
  }
  let x = p.x;
  let y = p.y;
  const guides: Guide[] = [];
  if (lock !== 'y') {
    let best: Point | null = null;
    for (const v of verts) if (Math.abs(v.x - p.x) <= tol && (!best || Math.abs(v.x - p.x) < Math.abs(best.x - p.x))) best = v;
    if (best) x = best.x;
    if (best) guides.push({ a: best, b: { x: best.x, y: p.y } });
  }
  if (lock !== 'x') {
    let best: Point | null = null;
    for (const v of verts) if (Math.abs(v.y - p.y) <= tol && (!best || Math.abs(v.y - p.y) < Math.abs(best.y - p.y))) best = v;
    if (best) y = best.y;
    if (best) guides.push({ a: best, b: { x: p.x, y: best.y } });
  }
  if (guides.length > 0) {
    // as guias terminam no ponto final, já com as duas coordenadas ajustadas
    for (const g of guides) g.b = { x, y };
    return { point: { x, y }, kind: 'align', guides };
  }
  return { point: p, kind: null, guides: [] };
}
