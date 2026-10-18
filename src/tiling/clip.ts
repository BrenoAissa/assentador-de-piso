import polygonClipping from 'polygon-clipping';
import { pointInPolygon } from '../geometry/polygon';
import type { Point, Rect, Ring } from '../geometry/types';

const EPS = 1e-7;

/** O segmento a→b passa pelo interior aberto do retângulo? (Liang–Barsky) */
function segmentHitsInterior(a: Point, b: Point, r: Rect): boolean {
  const xmin = r.x + EPS;
  const xmax = r.x + r.w - EPS;
  const ymin = r.y + EPS;
  const ymax = r.y + r.h - EPS;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - xmin, xmax - a.x, a.y - ymin, ymax - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t1 - t0 > EPS;
}

function rectRing(r: Rect): Ring {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/**
 * Parte do retângulo que fica dentro do cômodo, como anéis externos disjuntos.
 * Caminho rápido: se nenhuma parede cruza o retângulo, ele está todo dentro ou todo fora.
 */
export function clipRectToRing(rect: Rect, ring: Ring): Ring[] {
  let crosses = false;
  for (let i = 0, n = ring.length; i < n; i++) {
    if (segmentHitsInterior(ring[i], ring[(i + 1) % n], rect)) {
      crosses = true;
      break;
    }
  }
  if (!crosses) {
    const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    return pointInPolygon(center, ring) ? [rectRing(rect)] : [];
  }

  const subject: [number, number][][] = [ring.map((p) => [p.x, p.y] as [number, number])];
  const clip: [number, number][][] = [rectRing(rect).map((p) => [p.x, p.y] as [number, number])];
  const result = polygonClipping.intersection(subject, clip);
  return result.map((poly) => {
    const outer = poly[0];
    const pts = outer.slice(0, outer.length - 1);
    return pts.map(([x, y]) => ({ x, y }));
  });
}
