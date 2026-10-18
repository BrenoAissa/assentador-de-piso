import type { Mask } from './types';

export interface ComponentStats {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  touchesBorder: boolean;
}

/** Componentes conexos (vizinhança 4) dos pixels iguais a `target`. Rótulos começam em 1. */
export function labelComponents(m: Mask, target: 0 | 1): { labels: Int32Array; stats: ComponentStats[] } {
  const { w, h, data } = m;
  const labels = new Int32Array(w * h);
  const stats: ComponentStats[] = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (data[start] !== target || labels[start]) continue;
    const id = stats.length + 1;
    const s: ComponentStats = { area: 0, minX: w, minY: h, maxX: -1, maxY: -1, touchesBorder: false };
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top > 0) {
      const i = stack[--top];
      const x = i % w;
      const y = (i - x) / w;
      s.area++;
      if (x < s.minX) s.minX = x;
      if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y;
      if (y > s.maxY) s.maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) s.touchesBorder = true;
      if (x > 0 && data[i - 1] === target && !labels[i - 1]) (labels[i - 1] = id), (stack[top++] = i - 1);
      if (x < w - 1 && data[i + 1] === target && !labels[i + 1]) (labels[i + 1] = id), (stack[top++] = i + 1);
      if (y > 0 && data[i - w] === target && !labels[i - w]) (labels[i - w] = id), (stack[top++] = i - w);
      if (y < h - 1 && data[i + w] === target && !labels[i + w]) (labels[i + w] = id), (stack[top++] = i + w);
    }
    stats.push(s);
  }
  return { labels, stats };
}

/** Preenche os buracos da região (fundo que não alcança a borda). */
export function fillHoles(region: Mask): Mask {
  const { w, h, data } = region;
  const outside = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (i: number) => {
    if (!data[i] && !outside[i]) {
      outside[i] = 1;
      stack[top++] = i;
    }
  };
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  while (top > 0) {
    const i = stack[--top];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = outside[i] ? 0 : 1;
  return { w, h, data: out };
}

/** Preenche furos de fundo com área ≤ `maxArea` que não tocam a borda (falhas na hachura). */
export function fillSmallHoles(m: Mask, maxArea: number): Mask {
  const { labels, stats } = labelComponents(m, 0);
  const out = m.data.slice();
  for (let i = 0; i < out.length; i++) {
    const l = labels[i];
    if (l && !stats[l - 1].touchesBorder && stats[l - 1].area <= maxArea) out[i] = 1;
  }
  return { w: m.w, h: m.h, data: out };
}

/** Remove componentes de tinta com área menor que `minArea`. */
export function removeSmall(m: Mask, minArea: number): Mask {
  const { labels, stats } = labelComponents(m, 1);
  const out = new Uint8Array(m.data.length);
  for (let i = 0; i < out.length; i++) {
    const l = labels[i];
    if (l && stats[l - 1].area >= minArea) out[i] = 1;
  }
  return { w: m.w, h: m.h, data: out };
}
