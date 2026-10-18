import { bbox, polygonArea } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';

export function insertVertex(ring: Ring, edgeIndex: number, p: Point): Ring {
  const out = ring.slice();
  out.splice(edgeIndex + 1, 0, p);
  return out;
}

export function removeVertex(ring: Ring, i: number): Ring {
  if (ring.length <= 3) return ring;
  return ring.filter((_, j) => j !== i);
}

export function nearestEdge(ring: Ring, p: Point): { index: number; dist: number; foot: Point } {
  let best = { index: 0, dist: Infinity, foot: ring[0] };
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const foot = { x: a.x + t * dx, y: a.y + t * dy };
    const dist = Math.hypot(p.x - foot.x, p.y - foot.y);
    if (dist < best.dist) best = { index: i, dist, foot };
  }
  return best;
}

/** px por cm a partir de dois pontos na planta e a distância real entre eles. */
export function calibrationScale(a: Point, b: Point, cm: number): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / cm;
}

const fmt = (v: number, digits: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Ex.: "3,20 × 4,50 m (14,4 m²)", com largura e altura da caixa envolvente. */
export function roomSizeLabel(ring: Ring, pxPerCm: number): string {
  const b = bbox(ring);
  const w = b.w / pxPerCm / 100;
  const h = b.h / pxPerCm / 100;
  const area = polygonArea(ring) / (pxPerCm * pxPerCm) / 10000;
  return `${fmt(w, 2)} × ${fmt(h, 2)} m (${fmt(area, 1)} m²)`;
}
