import type { Gray, Mask, RGBAImage } from './types';

export function toGray(img: RGBAImage): Gray {
  const n = img.width * img.height;
  const data = new Uint8Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    // pixels transparentes contam como fundo branco
    const lum = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { w: img.width, h: img.height, data };
}

/** Limiar de Otsu; 0 quando a imagem não tem contraste. */
export function otsu(g: Gray): number {
  const hist = new Float64Array(256);
  for (const v of g.data) hist[v]++;
  const total = g.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t + 1;
    }
  }
  return threshold;
}

/** 1 onde o tom é mais escuro que o limiar. */
export function binarize(g: Gray, t: number): Mask {
  const data = new Uint8Array(g.data.length);
  for (let i = 0; i < data.length; i++) data[i] = g.data[i] < t ? 1 : 0;
  return { w: g.w, h: g.h, data };
}
