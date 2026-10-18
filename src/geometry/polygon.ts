import type { Point, Rect, Ring } from './types';

/** Área com sinal (fórmula do laço). Positiva = sentido anti-horário com y para cima. */
export function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(ring: Ring): number {
  return Math.abs(signedArea(ring));
}

export function bbox(rings: Ring | Ring[]): Rect {
  const list: Ring[] = rings.length > 0 && Array.isArray(rings[0]) ? (rings as Ring[]) : [rings as Ring];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of list) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function samePoint(a: Point, b: Point, eps: number): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

/** Remove pontos repetidos (inclusive o fechamento) e vértices colineares. */
export function cleanRing(ring: Ring, eps = 1e-6): Ring {
  const dedup: Ring = [];
  for (const p of ring) {
    if (dedup.length === 0 || !samePoint(dedup[dedup.length - 1], p, eps)) dedup.push(p);
  }
  while (dedup.length > 1 && samePoint(dedup[0], dedup[dedup.length - 1], eps)) dedup.pop();

  let pts = dedup;
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    const out: Ring = [];
    for (let i = 0, n = pts.length; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const next = pts[(i + 1) % n];
      const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
      if (Math.abs(cross(prev, cur, next)) / len <= eps) {
        changed = true;
        continue;
      }
      out.push(cur);
    }
    pts = out;
  }
  return pts;
}

/** Retângulo alinhado aos eixos (tolerando pontos repetidos/colineares). */
export function isAxisRect(ring: Ring, eps = 0.01): boolean {
  const r = cleanRing(ring, eps);
  if (r.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = r[i];
    const b = r[(i + 1) % 4];
    if (Math.abs(a.x - b.x) > eps && Math.abs(a.y - b.y) > eps) return false;
  }
  return true;
}

export function pointInPolygon(p: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Pelo menos 3 pontos distintos, área não nula e nenhuma aresta cruzando outra. */
export function isSimple(ring: Ring): boolean {
  const r = cleanRing(ring);
  const n = r.length;
  if (n < 3 || polygonArea(r) < 1e-9) return false;
  for (let i = 0; i < n; i++) {
    const a = r[i];
    const b = r[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsCross(a, b, r[j], r[(j + 1) % n])) return false;
    }
  }
  return true;
}

export function swapXY(ring: Ring): Ring {
  return ring.map((p) => ({ x: p.y, y: p.x }));
}

export function scaleRing(ring: Ring, k: number): Ring {
  return ring.map((p) => ({ x: p.x * k, y: p.y * k }));
}
