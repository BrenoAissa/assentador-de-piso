import { labelComponents } from './components';
import type { Mask } from './types';

/**
 * Distância (chanfro 3-4, em px) de cada pixel igual a `target` até o pixel diferente mais
 * próximo; fora da imagem conta como diferente.
 */
export function distanceTransform(m: Mask, target: 0 | 1): Float32Array {
  const { w, h, data } = m;
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = data[i] === target ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

/**
 * Plantas que desenham a parede como duas linhas paralelas: preenche as regiões brancas
 * fechadas que são faixas finas (raio inscrito pequeno e alongadas) ou células pequenas.
 */
export function fillOutlineWalls(m: Mask): Mask {
  const { w, h } = m;
  const { labels, stats } = labelComponents(m, 0);
  const dt = distanceTransform(m, 0);
  const maxR = new Float32Array(stats.length);
  for (let i = 0; i < w * h; i++) {
    const l = labels[i];
    if (l && dt[i] > maxR[l - 1]) maxR[l - 1] = dt[i];
  }
  const rMax = Math.max(6, Math.round(0.015 * Math.max(w, h)));
  const isWall = stats.map((s, i) => {
    if (s.touchesBorder || maxR[i] > rMax) return false;
    const elongated = s.area / (maxR[i] * maxR[i]) >= 8;
    const small = s.area <= rMax * rMax * 4;
    return elongated || small;
  });
  const out = m.data.slice();
  for (let i = 0; i < w * h; i++) {
    const l = labels[i];
    if (l && isWall[l - 1]) out[i] = 1;
  }
  return { w, h, data: out };
}
