import { runsAt } from './runs';
import type { Mask } from './types';

/** Fração de tinta dentro do vão a partir da qual ele é janela (linhas de caixilho). */
const FRAMED_INK = 0.06;
/** Diferença máxima, em px, entre as pontas de vãos vizinhos da mesma faixa. */
const ALIGN = 2;
const ROUNDS = 2;

export interface GapLimits {
  /** Vão vazio (porta, passagem) é fechado até este comprimento, em px. */
  maxOpen: number;
  /** Vão com caixilho (janela) é fechado até este comprimento, em px. */
  maxFramed: number;
}

interface Segment {
  line: number;
  start: number;
  end: number; // exclusivo
  group: number;
}

/**
 * Fecha vãos de porta e janela com fechamento direcional, linha a linha (horizontal) e coluna
 * a coluna (vertical). Um vão entre dois trechos de parede vira candidato quando:
 * - os dois trechos correm na direção do fechamento (sequência ≥ 1,5·t) e o vão ≤ maxFramed; ou
 * - um corre nessa direção (≥ 1,5·t, batente) e o outro é uma parede perpendicular
 *   (porta encostada num canto), com vão ≤ maxOpen. O batente precisa ser ponta livre de
 *   parede: se a ponta encosta no meio de outra parede desenhada (um T), é só uma parede
 *   apontando para o outro lado de um corredor, e não uma porta.
 * Os vãos de linhas vizinhas com as mesmas pontas formam uma faixa; a faixa só é preenchida se
 * tiver espessura ≤ 1,5·t e for curta (≤ maxOpen) ou tiver linhas de caixilho (janela).
 * Agrupar por pontas, e não por vizinhança de pixels, impede que um preenchimento falso (pia
 * que engrossa a parede, por exemplo) contamine o vão da porta ao lado.
 * São duas rodadas: um vão fechado na primeira pode servir de parede para outro na segunda.
 */
export function closeGaps(walls: Mask, ink: Mask, t: number, limits: GapLimits): { closed: Mask; filled: Mask } {
  const { w, h } = walls;
  const filled = new Uint8Array(w * h);
  let current = walls;
  for (let round = 0; round < ROUNDS; round++) {
    const add = new Uint8Array(w * h);
    for (const horizontal of [true, false]) fillStrips(current, walls, ink, t, limits, horizontal, add);
    let changed = false;
    const next = current.data.slice();
    for (let i = 0; i < w * h; i++) {
      if (add[i] && !next[i]) {
        next[i] = 1;
        filled[i] = 1;
        changed = true;
      }
    }
    current = { w, h, data: next };
    if (!changed) break;
  }
  return { closed: current, filled: { w, h, data: filled } };
}

function fillStrips(
  walls: Mask,
  drawn: Mask,
  ink: Mask,
  t: number,
  limits: GapLimits,
  horizontal: boolean,
  out: Uint8Array,
): void {
  const { w, h } = walls;
  const longRun = 1.5 * t;
  const perpRun = Math.max(2, 0.4 * t);
  const maxThick = 1.5 * t + 2;
  const lines = horizontal ? h : w;
  const idx = (line: number, pos: number) => (horizontal ? line * w + pos : pos * w + line);
  const reach = Math.round(t) + 2;
  /**
   * A ponta da parede que termina em `end` (andando para dentro com `step`) encosta no meio de
   * outra parede desenhada, formando um T? Olha várias profundidades até t px, porque a borda
   * desenhada é irregular (pias e bancadas engrossam a parede aqui e ali).
   */
  const tJunction = (l: number, end: number, step: 1 | -1, runLen: number) => {
    const before = l - reach;
    const after = l + reach;
    if (before < 0 || after >= lines) return false;
    const depth = Math.min(Math.round(t), runLen - 1);
    for (let d = 0; d <= depth; d++) {
      const pos = end + step * d;
      if (drawn.data[idx(before, pos)] === 1 && drawn.data[idx(after, pos)] === 1) return true;
    }
    return false;
  };

  // vãos candidatos, linha a linha
  const segs: Segment[] = [];
  const byLine: Segment[][] = [];
  for (let l = 0; l < lines; l++) {
    const row: Segment[] = [];
    const runs = runsAt(walls, l, horizontal);
    for (let k = 1; k < runs.length; k++) {
      const a = runs[k - 1];
      const b = runs[k];
      const gap = b.start - a.end;
      const la = a.end - a.start;
      const lb = b.end - b.start;
      const both = la >= longRun && lb >= longRun && gap <= limits.maxFramed;
      const cornerA = la >= longRun && lb >= perpRun && !tJunction(l, a.end - 1, -1, la);
      const cornerB = lb >= longRun && la >= perpRun && !tJunction(l, b.start, 1, lb);
      const corner = (cornerA || cornerB) && gap <= limits.maxOpen;
      if (!both && !corner) continue;
      const s: Segment = { line: l, start: a.end, end: b.start, group: segs.length };
      segs.push(s);
      row.push(s);
    }
    byLine.push(row);
  }

  // faixas: vãos de linhas vizinhas com as mesmas pontas (union-find)
  const parent = segs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let l = 1; l < lines; l++) {
    for (const s of byLine[l]) {
      for (const p of byLine[l - 1]) {
        if (Math.abs(s.start - p.start) <= ALIGN && Math.abs(s.end - p.end) <= ALIGN) parent[find(s.group)] = find(p.group);
      }
    }
  }

  const stats = new Map<number, { minLine: number; maxLine: number; length: number; area: number; ink: number }>();
  for (const s of segs) {
    const g = find(s.group);
    const st = stats.get(g) ?? { minLine: s.line, maxLine: s.line, length: 0, area: 0, ink: 0 };
    st.minLine = Math.min(st.minLine, s.line);
    st.maxLine = Math.max(st.maxLine, s.line);
    st.length = Math.max(st.length, s.end - s.start);
    for (let p = s.start; p < s.end; p++) {
      st.area++;
      if (ink.data[idx(s.line, p)]) st.ink++;
    }
    stats.set(g, st);
  }

  for (const s of segs) {
    const st = stats.get(find(s.group))!;
    const thick = st.maxLine - st.minLine + 1;
    const framed = st.ink / st.area >= FRAMED_INK;
    if (thick > maxThick || (st.length > limits.maxOpen && !framed)) continue;
    for (let p = s.start; p < s.end; p++) out[idx(s.line, p)] = 1;
  }
}
