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
  return otsuFromHistogram(hist);
}

function otsuFromHistogram(hist: Float64Array): number {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i];
    sum += i * hist[i];
  }
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

/** Abaixo deste tom de cinza é tinta mesmo que o Otsu diga outra coisa (papel de PDF é branco puro). */
const MIN_INK_THRESHOLD = 170;
const SATURATED = 0.4;
const VERY_DARK = 60;

/**
 * Tinta do desenho: tons escuros e pouco saturados. Cores saturadas (logotipos, faixas,
 * pisos coloridos de planta humanizada) ficam de fora, a menos que sejam muito escuras.
 * O limiar é o Otsu dos pixels não coloridos, nunca abaixo de 170, para não perder hachuras claras.
 */
export function inkMask(img: RGBAImage): Mask {
  const n = img.width * img.height;
  const d = img.data;
  const gray = new Uint8Array(n);
  const colored = new Uint8Array(n);
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    const r = d[i * 4] * a + 255 * (1 - a);
    const g = d[i * 4 + 1] * a + 255 * (1 - a);
    const b = d[i * 4 + 2] * a + 255 * (1 - a);
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const mx = Math.max(r, g, b);
    const sat = mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
    gray[i] = lum;
    if (sat >= SATURATED && lum >= VERY_DARK) colored[i] = 1;
    else hist[lum]++;
  }
  const t = Math.max(otsuFromHistogram(hist), MIN_INK_THRESHOLD);
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = !colored[i] && gray[i] < t ? 1 : 0;
  return { w: img.width, h: img.height, data };
}

/**
 * 1 onde a fração de tinta na janela win×win passa de `tau`. Junta hachuras e paredes cheias
 * numa faixa sólida; traços isolados de 1 px ficam abaixo do limiar.
 */
export function densityMask(m: Mask, win: number, tau: number): Mask {
  const { w, h, data } = m;
  const W = w + 1;
  const integral = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      integral[(y + 1) * W + x + 1] = integral[y * W + x + 1] + row;
    }
  }
  const r = Math.floor(win / 2);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s = integral[y1 * W + x1] - integral[y0 * W + x1] - integral[y1 * W + x0] + integral[y0 * W + x0];
      out[y * w + x] = s >= tau * (x1 - x0) * (y1 - y0) ? 1 : 0;
    }
  }
  return { w, h, data: out };
}

/**
 * Mantém de `region` só os pixels que são tinta ou que têm tinta dos dois lados (esquerda e
 * direita, ou acima e abaixo) a até `r` px. Tira o que a janela da densidade acrescenta por
 * fora de uma parede cheia sem comer o miolo de uma parede hachurada.
 */
export function sandwiched(ink: Mask, region: Mask, r: number): Mask {
  const { w, h, data } = ink;
  const near = (step: number, fromStart: boolean, horizontal: boolean) => {
    // distância até a tinta mais próxima numa direção, limitada a r + 1
    const dist = new Uint8Array(w * h);
    const lines = horizontal ? h : w;
    const n = horizontal ? w : h;
    for (let l = 0; l < lines; l++) {
      let last = r + 1;
      for (let k = 0; k < n; k++) {
        const pos = fromStart ? k : n - 1 - k;
        const i = horizontal ? l * w + pos : pos * w + l;
        last = data[i] ? 0 : Math.min(r + 1, last + step);
        dist[i] = last;
      }
    }
    return dist;
  };
  const left = near(1, true, true);
  const right = near(1, false, true);
  const up = near(1, true, false);
  const down = near(1, false, false);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!region.data[i]) continue;
    if (data[i] || (left[i] <= r && right[i] <= r) || (up[i] <= r && down[i] <= r)) out[i] = 1;
  }
  return { w, h, data: out };
}

/** 1 onde o tom é mais escuro que o limiar. */
export function binarize(g: Gray, t: number): Mask {
  const data = new Uint8Array(g.data.length);
  for (let i = 0; i < data.length; i++) data[i] = g.data[i] < t ? 1 : 0;
  return { w: g.w, h: g.h, data };
}
