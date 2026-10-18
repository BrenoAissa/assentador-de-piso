import type { Mask } from './types';

/** Helpers de teste: desenham plantas em máscaras (1 = tinta). */
export function makeMask(w: number, h: number): Mask {
  return { w, h, data: new Uint8Array(w * h) };
}

export function fillRect(m: Mask, x: number, y: number, w: number, h: number, v = 1): void {
  for (let j = Math.max(0, y); j < Math.min(m.h, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(m.w, x + w); i++) m.data[j * m.w + i] = v;
}

export function clearRect(m: Mask, x: number, y: number, w: number, h: number): void {
  fillRect(m, x, y, w, h, 0);
}

/** Moldura retangular com espessura t para dentro a partir de (x, y, w, h). */
export function frame(m: Mask, x: number, y: number, w: number, h: number, t: number): void {
  fillRect(m, x, y, w, t);
  fillRect(m, x, y + h - t, w, t);
  fillRect(m, x, y, t, h);
  fillRect(m, x + w - t, y, t, h);
}

/** Traço fino de 1 px. */
export function line(m: Mask, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.data[y * m.w + x] = 1;
  }
}

/** Converte a máscara em imagem RGBA (tinta escura sobre fundo branco). */
export function maskToImage(m: Mask): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(m.w * m.h * 4);
  for (let i = 0; i < m.w * m.h; i++) {
    const v = m.data[i] ? 30 : 255;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: m.w, height: m.h, data };
}
