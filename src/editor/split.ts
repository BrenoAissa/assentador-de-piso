import polygonClipping, { type Polygon } from 'polygon-clipping';
import { bbox, cleanRing } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';

const toPoly = (ring: Ring): Polygon => [[...ring.map((p) => [p.x, p.y] as [number, number]), [ring[0].x, ring[0].y]]];

/**
 * Divide um cômodo pela reta que passa por `a` e `b` (a divisa onde o piso muda). Devolve os dois
 * lados, ou null se a reta não atravessa o cômodo ou se algum lado sairia em mais de um pedaço.
 */
export function splitRing(ring: Ring, a: Point, b: Point): [Ring, Ring] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const box = bbox(ring);
  // semiplanos como quadriláteros bem maiores que o cômodo, um de cada lado da reta
  const far = (box.w + box.h) * 4 + Math.hypot(a.x - box.x, a.y - box.y) + len;
  const ux = dx / len;
  const uy = dy / len;
  const p1 = { x: a.x - ux * far, y: a.y - uy * far };
  const p2 = { x: a.x + ux * far, y: a.y + uy * far };
  const side = (s: 1 | -1): Ring => [p1, p2, { x: p2.x - uy * far * s, y: p2.y + ux * far * s }, { x: p1.x - uy * far * s, y: p1.y + ux * far * s }];
  const parts: Ring[] = [];
  for (const s of [1, -1] as const) {
    const res = polygonClipping.intersection(toPoly(ring), toPoly(side(s)));
    // exatamente um pedaço, sem buraco
    if (res.length !== 1 || res[0].length !== 1) return null;
    const outer = cleanRing(res[0][0].slice(0, -1).map(([x, y]) => ({ x, y })));
    if (outer.length < 3) return null;
    parts.push(outer);
  }
  return [parts[0], parts[1]];
}
