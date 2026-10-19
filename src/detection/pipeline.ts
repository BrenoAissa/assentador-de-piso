import { bbox, cleanRing, polygonArea } from '../geometry/polygon';
import { densityMask, inkMask, sandwiched } from './binarize';
import { fillHoles, fillSmallHoles, labelComponents, removeSmall } from './components';
import { traceContour } from './contour';
import { closeGaps } from './gaps';
import { open } from './morphology';
import { fillOutlineWalls } from './outline';
import { douglasPeucker, orthogonalize } from './simplify';
import { estimateWallThickness } from './thickness';
import type { CvResult, CvRoom, DetectOptions, Mask, RGBAImage } from './types';

interface WallPass {
  mode: 'filled' | 'outline';
  t: number;
  walls: Mask;
}

/**
 * Paredes cheias ou hachuradas: densidade de tinta numa janela 7×7 ≥ 25% vira faixa sólida;
 * o filtro "entre tintas" desfaz o quanto a janela engorda a borda de uma parede cheia.
 */
function solidWalls(ink: Mask): Mask {
  return sandwiched(ink, densityMask(ink, 7, 0.25), 3);
}

function wallPass(ink: Mask, mode: 'filled' | 'outline'): WallPass | null {
  const raw = mode === 'outline' ? fillOutlineWalls(ink) : solidWalls(ink);
  const t0 = estimateWallThickness(raw);
  if (t0 < 3) return null;
  // furos pequenos dentro da parede (hachura rala) picotariam a parede na abertura
  const src = fillSmallHoles(raw, t0 * t0);
  const t = estimateWallThickness(src);
  if (t < 3) return null;
  // 0,45·t: paredes internas podem ter metade da espessura das externas (que dominam t)
  const walls = removeSmall(open(src, Math.ceil(0.45 * t)), 12 * t * t);
  return { mode, t, walls };
}

/**
 * Paredes → cômodos (coordenadas em px da imagem recebida). Função pura.
 * No modo automático tenta paredes cheias/hachuradas e, se não sair nenhum cômodo, paredes
 * só com contorno; fica com o que encontrar mais cômodos.
 */
export function detectRooms(img: RGBAImage, opts: DetectOptions = {}): CvResult {
  const mode = opts.mode ?? 'auto';
  const ink = inkMask(img);

  const first = wallPass(ink, mode === 'outline' ? 'outline' : 'filled');
  let best = first ? { pass: first, rooms: extractRooms(first, ink, opts) } : null;
  if (mode === 'auto' && (!best || best.rooms.length === 0)) {
    const alt = wallPass(ink, 'outline');
    if (alt) {
      const rooms = extractRooms(alt, ink, opts);
      if (!best || rooms.length > best.rooms.length) best = { pass: alt, rooms };
    }
  }
  if (!best) {
    return {
      rooms: [],
      wallThicknessPx: 0,
      mode: 'filled',
      warnings: ['Não encontrei paredes na planta. Desenhe os cômodos à mão com "Novo cômodo".'],
    };
  }
  const warnings: string[] = [];
  if (best.rooms.length === 0) {
    warnings.push('Nenhum cômodo fechado foi encontrado. Ajuste a sensibilidade ou desenhe os cômodos à mão.');
  }
  return { rooms: best.rooms, wallThicknessPx: best.pass.t, mode: best.pass.mode, warnings };
}

/** Fecha os vãos e transforma cada área livre fechada num polígono de cômodo. */
function extractRooms(pass: WallPass, ink: Mask, opts: DetectOptions): CvRoom[] {
  const { t, walls } = pass;
  const k = opts.sensitivity ?? 1;
  // porta/passagem vazia até ~9·t (≈ 1,4 m); janela com caixilho até ~25·t
  const { closed, filled } = closeGaps(walls, ink, t, { maxOpen: Math.round(9 * t * k), maxFramed: Math.round(25 * t * k) });
  const { labels, stats } = labelComponents(closed, 0);
  const { w } = closed;
  // (5·t)² ≈ 0,6 m² com paredes de 15 cm: corredores, lavabos e closets entram
  const minArea = (5 * t) * (5 * t);
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
  return rooms;
}
