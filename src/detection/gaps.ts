import { labelComponents } from './components';
import { runsAt } from './runs';
import type { Mask } from './types';

/** Fração de tinta dentro do vão a partir da qual ele é janela (linhas de caixilho). */
const FRAMED_INK = 0.06;

export interface GapLimits {
  /** Vão vazio (porta, passagem) é fechado até este comprimento, em px. */
  maxOpen: number;
  /** Vão com caixilho (janela) é fechado até este comprimento, em px. */
  maxFramed: number;
}

/**
 * Fecha vãos de porta e janela com fechamento direcional, linha a linha (horizontal) e coluna
 * a coluna (vertical). Um vão entre dois trechos de parede vira candidato quando:
 * - os dois trechos correm na direção do fechamento (sequência ≥ 1,5·t) e o vão ≤ maxFramed; ou
 * - só um corre nessa direção e o outro é uma parede perpendicular (porta encostada num canto),
 *   com vão ≤ maxOpen.
 * O interior de um cômodo nunca vira candidato: ali as sequências são a espessura das paredes
 * perpendiculares (≈ t). Depois, cada preenchimento só fica se tiver espessura ≤ 1,5·t e for
 * curto (≤ maxOpen) ou tiver linhas de caixilho dentro (janela).
 */
export function closeGaps(walls: Mask, ink: Mask, t: number, limits: GapLimits): { closed: Mask; filled: Mask } {
  const { w, h } = walls;
  const longRun = 1.5 * t;
  const perpRun = Math.max(2, 0.4 * t);
  const maxThick = 1.5 * t + 2;

  const candidates = (horizontal: boolean): Mask => {
    const f = new Uint8Array(w * h);
    const lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      const runs = runsAt(walls, l, horizontal);
      for (let k = 1; k < runs.length; k++) {
        const a = runs[k - 1];
        const b = runs[k];
        const gap = b.start - a.end;
        const la = a.end - a.start;
        const lb = b.end - b.start;
        const both = la >= longRun && lb >= longRun && gap <= limits.maxFramed;
        const corner = ((la >= longRun && lb >= perpRun) || (lb >= longRun && la >= perpRun)) && gap <= limits.maxOpen;
        if (!both && !corner) continue;
        for (let i = a.end; i < b.start; i++) f[horizontal ? l * w + i : i * w + l] = 1;
      }
    }
    return { w, h, data: f };
  };

  const keep = (f: Mask, horizontal: boolean): Uint8Array => {
    const { labels, stats } = labelComponents(f, 1);
    const inkCount = new Float64Array(stats.length);
    for (let i = 0; i < w * h; i++) if (labels[i] && ink.data[i]) inkCount[labels[i] - 1]++;
    const ok = stats.map((s, idx) => {
      const thick = horizontal ? s.maxY - s.minY + 1 : s.maxX - s.minX + 1;
      const length = horizontal ? s.maxX - s.minX + 1 : s.maxY - s.minY + 1;
      const framed = inkCount[idx] / s.area >= FRAMED_INK;
      return thick <= maxThick && (length <= limits.maxOpen || framed);
    });
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (labels[i] && ok[labels[i] - 1]) out[i] = 1;
    return out;
  };

  const fh = keep(candidates(true), true);
  const fv = keep(candidates(false), false);
  const closed = new Uint8Array(w * h);
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    filled[i] = fh[i] | fv[i];
    closed[i] = walls.data[i] | filled[i];
  }
  return { closed: { w, h, data: closed }, filled: { w, h, data: filled } };
}
