import type { Mask } from './types';

export interface Run {
  start: number;
  end: number; // exclusivo
}

/** Sequências de 1 numa linha (horizontal) ou coluna (vertical) da máscara. */
export function runsAt(m: Mask, index: number, horizontal: boolean): Run[] {
  const n = horizontal ? m.w : m.h;
  const out: Run[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const v = i < n ? m.data[horizontal ? index * m.w + i : i * m.w + index] : 0;
    if (v && start < 0) start = i;
    else if (!v && start >= 0) {
      out.push({ start, end: i });
      start = -1;
    }
  }
  return out;
}
