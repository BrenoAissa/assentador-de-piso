import type { Mask } from './types';

/** Mínimo/máximo em janela 1D via soma prefixada: O(n) independente do tamanho da janela. */
function pass(src: Uint8Array, w: number, h: number, k: number, horizontal: boolean, erode: boolean): Uint8Array {
  if (k <= 1) return src.slice();
  const out = new Uint8Array(w * h);
  const before = Math.floor((k - 1) / 2);
  const after = k - 1 - before;
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const pre = new Int32Array(n + 1);
  for (let l = 0; l < lines; l++) {
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + src[horizontal ? l * w + i : i * w + l];
    for (let i = 0; i < n; i++) {
      const lo = i - before;
      const hi = i + after;
      const s = pre[Math.min(n - 1, hi) + 1] - pre[Math.max(0, lo)];
      const v = erode ? (lo >= 0 && hi < n && s === k ? 1 : 0) : s > 0 ? 1 : 0;
      out[horizontal ? l * w + i : i * w + l] = v;
    }
  }
  return out;
}

export function erode(m: Mask, kw: number, kh: number): Mask {
  return { w: m.w, h: m.h, data: pass(pass(m.data, m.w, m.h, kw, true, true), m.w, m.h, kh, false, true) };
}

export function dilate(m: Mask, kw: number, kh: number): Mask {
  return { w: m.w, h: m.h, data: pass(pass(m.data, m.w, m.h, kw, true, false), m.w, m.h, kh, false, false) };
}

/** Abertura com quadrado k×k: apaga traços mais finos que k. */
export function open(m: Mask, k: number): Mask {
  return dilate(erode(m, k, k), k, k);
}
