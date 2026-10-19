import { bbox, cleanRing, polygonArea } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import type { Scale } from '../types';
import type { LinearDim } from './types';

const DIMS_AGREEMENT = 0.08;
const MISMATCH = 0.1;

interface RoomText {
  polygonPx: Ring;
  dims?: { a: number; b: number };
  areaM2?: number;
  linear?: LinearDim[];
}

interface Candidate {
  room: number;
  pxPerCm: number;
  /** Peso: tamanho da medida em cm (medidas maiores erram menos em proporção). */
  weight: number;
}

/** Estimativas de px/cm de um cômodo a partir dos textos lidos dentro dele. */
function roomCandidates(r: RoomText, room: number): Candidate[] {
  const out: Candidate[] = [];
  const b = bbox(r.polygonPx);
  if (r.dims && r.dims.a > 0 && r.dims.b > 0) {
    const { a, b: c } = r.dims;
    const best = [
      [b.w / (a * 100), b.h / (c * 100)],
      [b.w / (c * 100), b.h / (a * 100)],
    ]
      .map(([e1, e2]) => ({ e: (e1 + e2) / 2, diff: Math.abs(e1 - e2) / ((e1 + e2) / 2) }))
      .sort((x, y) => x.diff - y.diff)[0];
    if (best.diff <= DIMS_AGREEMENT) out.push({ room, pxPerCm: best.e, weight: (a + c) * 100 });
  }
  if (r.areaM2 && r.areaM2 > 0) {
    out.push({ room, pxPerCm: Math.sqrt(polygonArea(r.polygonPx) / (r.areaM2 * 10000)), weight: Math.sqrt(r.areaM2) * 100 });
  }
  // Cotas lineares só em cômodo retangular: a maior cota de cada eixo é a largura/altura dele.
  if (r.linear?.length && cleanRing(r.polygonPx, 0.5).length === 4) {
    for (const vertical of [false, true]) {
      const values = r.linear.filter((d) => d.vertical === vertical).map((d) => d.valueM);
      if (values.length === 0) continue;
      const m = Math.max(...values);
      out.push({ room, pxPerCm: (vertical ? b.h : b.w) / (m * 100), weight: m * 100 });
    }
  }
  return out;
}

function weightedMedian(c: Candidate[]): number {
  const s = [...c].sort((a, b) => a.pxPerCm - b.pxPerCm);
  const half = s.reduce((t, x) => t + x.weight, 0) / 2;
  let acc = 0;
  for (const x of s) {
    acc += x.weight;
    if (acc >= half) return x.pxPerCm;
  }
  return s[s.length - 1].pxPerCm;
}

/**
 * Escala do desenho: mediana ponderada de todas as estimativas (medidas "L x C", áreas e cotas
 * lineares). Um cômodo é apontado quando nenhuma estimativa dele fica a até 10% da escala final.
 */
export function estimateScale(rooms: RoomText[]): { scale: Scale | null; mismatched: number[] } {
  const all = rooms.flatMap(roomCandidates);
  if (all.length === 0) return { scale: null, mismatched: [] };
  const med = weightedMedian(all);
  const withData = new Set(all.map((c) => c.room));
  const agrees = new Set(all.filter((c) => Math.abs(c.pxPerCm - med) / med <= MISMATCH).map((c) => c.room));
  const mismatched = [...withData].filter((r) => !agrees.has(r)).sort((a, b) => a - b);
  const confidence = withData.size === 1 ? 0.6 : Math.max(0.3, agrees.size / withData.size);
  return { scale: { pxPerCm: med, source: 'ocr', confidence }, mismatched };
}
