import { labelComponents } from './components';
import { runsAt } from './runs';
import type { Mask } from './types';

/**
 * Fecha vãos de porta e janela com fechamento direcional.
 * Na vertical, um vão de uma coluna é preenchido só se os trechos de parede acima e abaixo
 * correm na vertical (sequência ≥ 1,5·t) e o vão tem até D. Assim, o interior de um cômodo
 * (limitado por paredes horizontais, sequência = t) não é preenchido. Depois, só ficam os
 * preenchimentos com espessura ≤ 1,5·t no eixo perpendicular. O mesmo vale na horizontal.
 */
export function closeGaps(walls: Mask, t: number, D: number): { closed: Mask; filled: Mask } {
  const { w, h } = walls;
  const minRun = 1.5 * t;
  const maxThick = 1.5 * t + 2;

  const candidates = (horizontal: boolean): Mask => {
    const f = new Uint8Array(w * h);
    const lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      const runs = runsAt(walls, l, horizontal);
      for (let k = 1; k < runs.length; k++) {
        const a = runs[k - 1];
        const b = runs[k];
        if (b.start - a.end > D || a.end - a.start < minRun || b.end - b.start < minRun) continue;
        for (let i = a.end; i < b.start; i++) f[horizontal ? l * w + i : i * w + l] = 1;
      }
    }
    return { w, h, data: f };
  };

  const keepThin = (f: Mask, horizontal: boolean): Uint8Array => {
    const { labels, stats } = labelComponents(f, 1);
    const ok = stats.map((s) => (horizontal ? s.maxY - s.minY + 1 : s.maxX - s.minX + 1) <= maxThick);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (labels[i] && ok[labels[i] - 1]) out[i] = 1;
    return out;
  };

  const fh = keepThin(candidates(true), true);
  const fv = keepThin(candidates(false), false);
  const closed = new Uint8Array(w * h);
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    filled[i] = fh[i] | fv[i];
    closed[i] = walls.data[i] | filled[i];
  }
  return { closed: { w, h, data: closed }, filled: { w, h, data: filled } };
}
