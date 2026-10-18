import type { Point, Ring } from '../geometry/types';
import type { Mask } from './types';

// Direções com y para baixo: leste, sul, oeste, norte.
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
// Pixels à frente-esquerda e à frente-direita de um canto (x, y), por direção.
const AHEAD_LEFT = [
  [0, -1],
  [0, 0],
  [-1, 0],
  [-1, -1],
];
const AHEAD_RIGHT = [
  [0, 0],
  [-1, 0],
  [-1, -1],
  [0, -1],
];

/**
 * Contorno externo da região (pixels = 1, vizinhança 4), seguindo as bordas entre pixels.
 * Os vértices ficam nos cantos dos pixels, então a área do polígono = número de pixels.
 */
export function traceContour(region: Mask): Ring {
  const { w, h, data } = region;
  let first = -1;
  for (let i = 0; i < w * h; i++) {
    if (data[i]) {
      first = i;
      break;
    }
  }
  if (first < 0) return [];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1;

  const sx = first % w;
  const sy = (first - sx) / w;
  const pts: Point[] = [{ x: sx, y: sy }];
  let x = sx;
  let y = sy;
  let d = 0;
  for (let guard = 0; guard < 4 * (w + 1) * (h + 1); guard++) {
    x += DIRS[d][0];
    y += DIRS[d][1];
    if (x === sx && y === sy) break;
    const left = inside(x + AHEAD_LEFT[d][0], y + AHEAD_LEFT[d][1]);
    const right = inside(x + AHEAD_RIGHT[d][0], y + AHEAD_RIGHT[d][1]);
    const nd = !right ? (d + 1) % 4 : left ? (d + 3) % 4 : d;
    if (nd !== d) pts.push({ x, y });
    d = nd;
  }
  return pts;
}
