import type { FloorInput } from '../tiling/types';
import type { Ring } from './types';

/**
 * Os dois contornos se encostam (sem parede entre eles)? Algum par de bordas fica na mesma reta,
 * a até `tolCm`, e as duas se sobrepõem por mais de `tolCm`. Só um canto em comum não conta.
 */
export function ringsTouch(a: Ring, b: Ring, tolCm = 1): boolean {
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = a[(i + 1) % a.length];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len <= tolCm) continue;
    const ux = (q.x - p.x) / len;
    const uy = (q.y - p.y) / len;
    const off = (r: { x: number; y: number }) => Math.abs((r.x - p.x) * uy - (r.y - p.y) * ux);
    const along = (r: { x: number; y: number }) => (r.x - p.x) * ux + (r.y - p.y) * uy;
    for (let j = 0; j < b.length; j++) {
      const r = b[j];
      const s = b[(j + 1) % b.length];
      if (off(r) > tolCm || off(s) > tolCm) continue;
      const lo = Math.max(0, Math.min(along(r), along(s)));
      const hi = Math.min(len, Math.max(along(r), along(s)));
      if (hi - lo > tolCm) return true;
    }
  }
  return false;
}

/** Algum cômodo de um piso encosta (sem parede) num cômodo de outro piso: há uma divisa. */
export function floorsTouch(floors: FloorInput[]): boolean {
  for (let i = 0; i < floors.length; i++) {
    for (let j = i + 1; j < floors.length; j++) {
      for (const ra of floors[i].rooms) for (const rb of floors[j].rooms) if (ringsTouch(ra.ring, rb.ring)) return true;
    }
  }
  return false;
}
