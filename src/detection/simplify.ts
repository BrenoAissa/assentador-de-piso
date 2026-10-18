import type { Point, Ring } from '../geometry/types';

function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function dpOpen(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = dpOpen(pts.slice(0, idx + 1), eps);
  const right = dpOpen(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

/** Douglas–Peucker para anel fechado (divide no ponto mais distante do primeiro). */
export function douglasPeucker(ring: Ring, eps: number): Ring {
  if (ring.length <= 3) return ring;
  let far = 0;
  let farD = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = dpOpen(ring.slice(0, far + 1), eps);
  const b = dpOpen([...ring.slice(far), ring[0]], eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

/** Endireita arestas com até `maxDeg` de inclinação em relação aos eixos. */
export function orthogonalize(ring: Ring, maxDeg = 5): Ring {
  const n = ring.length;
  const tol = Math.tan((maxDeg * Math.PI) / 180);
  const kind = ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dy <= dx * tol) return 'h';
    if (dx <= dy * tol) return 'v';
    return 'o';
  });
  return ring.map((p, i) => {
    const prev = (i - 1 + n) % n;
    const a = ring[prev];
    const b = ring[(i + 1) % n];
    let { x, y } = p;
    if (kind[prev] === 'v') x = (a.x + p.x) / 2;
    else if (kind[i] === 'v') x = (p.x + b.x) / 2;
    if (kind[prev] === 'h') y = (a.y + p.y) / 2;
    else if (kind[i] === 'h') y = (p.y + b.y) / 2;
    return { x, y };
  });
}
