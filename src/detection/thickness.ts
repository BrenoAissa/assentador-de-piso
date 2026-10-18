import { runsAt } from './runs';
import type { Mask } from './types';

/**
 * Espessura típica das paredes, em px. Cada pixel escuro recebe min(sequência horizontal,
 * sequência vertical) — a espessura local do traço — e o resultado é a moda (suavizada)
 * entre 3 px e 5% do tamanho da imagem, ponderada pela quantidade de pixels.
 * Devolve 0 quando não há traços grossos.
 */
export function estimateWallThickness(m: Mask): number {
  const { w, h } = m;
  const hr = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (const r of runsAt(m, y, true)) for (let x = r.start; x < r.end; x++) hr[y * w + x] = r.end - r.start;
  const maxT = Math.max(6, Math.round(0.05 * Math.max(w, h)));
  const hist = new Float64Array(maxT + 2);
  for (let x = 0; x < w; x++) {
    for (const r of runsAt(m, x, false)) {
      const len = r.end - r.start;
      for (let y = r.start; y < r.end; y++) {
        const v = Math.min(len, hr[y * w + x]);
        if (v >= 3 && v <= maxT) hist[v]++;
      }
    }
  }
  let best = 0;
  let bestScore = 0;
  for (let v = 3; v <= maxT; v++) {
    const score = hist[v - 1] + hist[v] + hist[v + 1];
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  if (bestScore === 0) return 0;
  let s = 0;
  let wsum = 0;
  for (let v = best - 1; v <= best + 1; v++) {
    s += v * hist[v];
    wsum += hist[v];
  }
  return Math.round(s / wsum);
}
