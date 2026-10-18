import { bbox, polygonArea } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import type { Scale } from '../types';

const DIMS_AGREEMENT = 0.08;
const MISMATCH = 0.1;

interface RoomText {
  polygonPx: Ring;
  dims?: { a: number; b: number };
  areaM2?: number;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Estimativa de px/cm de um cômodo a partir das medidas e da área lidas no OCR. */
function roomEstimate(r: RoomText): number | null {
  const found: number[] = [];
  const b = bbox(r.polygonPx);
  if (r.dims && r.dims.a > 0 && r.dims.b > 0) {
    const { a, b: c } = r.dims;
    const best = [
      [b.w / (a * 100), b.h / (c * 100)],
      [b.w / (c * 100), b.h / (a * 100)],
    ]
      .map(([e1, e2]) => ({ e: (e1 + e2) / 2, diff: Math.abs(e1 - e2) / ((e1 + e2) / 2) }))
      .sort((x, y) => x.diff - y.diff)[0];
    if (best.diff <= DIMS_AGREEMENT) found.push(best.e);
  }
  if (r.areaM2 && r.areaM2 > 0) found.push(Math.sqrt(polygonArea(r.polygonPx) / (r.areaM2 * 10000)));
  return found.length ? median(found) : null;
}

/** Escala do desenho pela mediana das estimativas; aponta os cômodos que destoam mais de 10%. */
export function estimateScale(rooms: RoomText[]): { scale: Scale | null; mismatched: number[] } {
  const per = rooms.map(roomEstimate);
  const vals = per.filter((e): e is number => e !== null);
  if (vals.length === 0) return { scale: null, mismatched: [] };
  const med = median(vals);
  const mismatched = per.flatMap((e, i) => (e !== null && Math.abs(e - med) / med > MISMATCH ? [i] : []));
  const meanDev = vals.reduce((s, e) => s + Math.abs(e - med) / med, 0) / vals.length;
  const confidence = vals.length === 1 ? 0.6 : Math.max(0.3, Math.min(1, 1 - meanDev * 5));
  return { scale: { pxPerCm: med, source: 'ocr', confidence }, mismatched };
}
