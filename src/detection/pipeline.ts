import { bbox, cleanRing, polygonArea } from '../geometry/polygon';
import { binarize, otsu, toGray } from './binarize';
import { fillHoles, labelComponents, removeSmall } from './components';
import { traceContour } from './contour';
import { closeGaps } from './gaps';
import { open } from './morphology';
import { fillOutlineWalls } from './outline';
import { douglasPeucker, orthogonalize } from './simplify';
import { estimateWallThickness } from './thickness';
import type { CvResult, CvRoom, DetectOptions, Mask, RGBAImage } from './types';

const MIN_WALL_FRACTION = 0.02;

interface WallPass {
  mode: 'filled' | 'outline';
  t: number;
  walls: Mask;
  fraction: number;
}

function wallPass(ink: Mask, mode: 'filled' | 'outline'): WallPass | null {
  const src = mode === 'outline' ? fillOutlineWalls(ink) : ink;
  const t = estimateWallThickness(src);
  if (t < 3) return null;
  // 0,45·t: paredes internas podem ter metade da espessura das externas (que dominam t)
  const walls = removeSmall(open(src, Math.ceil(0.45 * t)), 12 * t * t);
  let n = 0;
  for (const v of walls.data) n += v;
  return { mode, t, walls, fraction: n / walls.data.length };
}

/** Paredes → cômodos (coordenadas em px da imagem recebida). Função pura. */
export function detectRooms(img: RGBAImage, opts: DetectOptions = {}): CvResult {
  const mode = opts.mode ?? 'auto';
  const gray = toGray(img);
  const ink = binarize(gray, otsu(gray));

  let pass = wallPass(ink, mode === 'outline' ? 'outline' : 'filled');
  if (mode === 'auto' && (!pass || pass.fraction < MIN_WALL_FRACTION)) {
    const alt = wallPass(ink, 'outline');
    if (alt && alt.fraction > (pass?.fraction ?? 0)) pass = alt;
  }
  if (!pass) {
    return {
      rooms: [],
      wallThicknessPx: 0,
      mode: 'filled',
      warnings: ['Não encontrei paredes na planta. Desenhe os cômodos à mão com "Novo cômodo".'],
    };
  }

  const { t, walls } = pass;
  const D = Math.round(20 * t * (opts.sensitivity ?? 1));
  const { closed, filled } = closeGaps(walls, t, D);
  const { labels, stats } = labelComponents(closed, 0);
  const { w } = closed;
  const minArea = (8 * t) * (8 * t);
  const rooms: CvRoom[] = [];

  stats.forEach((s, idx) => {
    if (s.touchesBorder || s.area < minArea) return;
    const id = idx + 1;
    const cw = s.maxX - s.minX + 3;
    const ch = s.maxY - s.minY + 3;
    const crop = new Uint8Array(cw * ch);
    let touchesGap = false;
    for (let y = s.minY; y <= s.maxY; y++) {
      for (let x = s.minX; x <= s.maxX; x++) {
        const i = y * w + x;
        if (labels[i] !== id) continue;
        crop[(y - s.minY + 1) * cw + (x - s.minX + 1)] = 1;
        if (!touchesGap && (filled.data[i - 1] || filled.data[i + 1] || filled.data[i - w] || filled.data[i + w])) {
          touchesGap = true;
        }
      }
    }
    const region = fillHoles({ w: cw, h: ch, data: crop });
    const traced = traceContour(region).map((p) => ({ x: p.x + s.minX - 1, y: p.y + s.minY - 1 }));
    const ring = cleanRing(orthogonalize(douglasPeucker(traced, t / 2), 5), 0.5);
    if (ring.length < 3) return;
    const b = bbox(ring);
    const rect = polygonArea(ring) / Math.max(1, b.w * b.h);
    const vertexScore = ring.length <= 8 ? 0.2 : ring.length <= 14 ? 0.1 : 0;
    const confidence = Math.max(0, Math.min(1, 0.45 + 0.35 * rect + vertexScore - (touchesGap ? 0.1 : 0)));
    rooms.push({ polygonPx: ring, confidence });
  });

  rooms.sort((a, b) => {
    const ba = bbox(a.polygonPx);
    const bb = bbox(b.polygonPx);
    return Math.abs(ba.y - bb.y) > 4 * t ? ba.y - bb.y : ba.x - bb.x;
  });

  const warnings: string[] = [];
  if (rooms.length === 0) {
    warnings.push('Nenhum cômodo fechado foi encontrado. Ajuste a sensibilidade ou desenhe os cômodos à mão.');
  }
  return { rooms, wallThicknessPx: t, mode: pass.mode, warnings };
}
