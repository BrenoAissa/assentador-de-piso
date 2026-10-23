/**
 * Gera a imagem de prévia do link (public/og.png, 1200 × 630, a que aparece no WhatsApp) e os
 * ícones (public/favicon.svg, public/apple-touch-icon.png) a partir do lar de exemplo.
 *
 *   npx vite-node scripts/make-og.ts
 */
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { bbox } from '../src/geometry/polygon';
import type { Ring } from '../src/geometry/types';
import { pieceFill } from '../src/report/PlanSvg';
import { SAMPLE_DOOR, SAMPLE_ORIGIN, sampleProject } from '../src/sample';
import { roomsInCm } from '../src/store/issues';
import { computeLayout } from '../src/tiling/engine';

const FONT = 'Archivo';
GlobalFonts.registerFromPath('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2', FONT);

const C = {
  papel: '#f3f4f2',
  grade: '#e3e6e2',
  grafite: '#22262a',
  grafite2: '#5f666c',
  fita: '#f2c230',
  fitaEscura: '#b88a06',
  inteira: '#c9ced2',
  rejunte: '#6b7177',
};

function brandMark(g: SKRSContext2D, x: number, y: number, size: number) {
  const gap = size * 0.12;
  const s = (size - gap) / 2;
  const fills = [C.inteira, C.fita, C.inteira, C.inteira];
  fills.forEach((f, i) => {
    g.fillStyle = f;
    g.fillRect(x + (i % 2) * (s + gap), y + Math.floor(i / 2) * (s + gap), s, s);
  });
}

function path(g: SKRSContext2D, ring: Ring, k: number, ox: number, oy: number) {
  g.beginPath();
  ring.forEach((p, i) => (i ? g.lineTo(ox + p.x * k, oy + p.y * k) : g.moveTo(ox + p.x * k, oy + p.y * k)));
  g.closePath();
}

function og() {
  const W = 1200;
  const H = 630;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');

  g.fillStyle = C.papel;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = C.grade;
  g.lineWidth = 1;
  for (let x = 0.5; x < W; x += 24) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  for (let y = 0.5; y < H; y += 24) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }

  // texto
  brandMark(g, 64, 62, 30);
  g.fillStyle = C.grafite;
  g.font = `700 28px ${FONT}`;
  g.fillText('Assentador de piso', 108, 87);
  g.font = `800 70px ${FONT}`;
  ['Veja como o piso', 'fica no seu lar', 'antes de comprar'].forEach((l, i) => g.fillText(l, 64, 228 + i * 78));
  g.fillStyle = '#3a3f44';
  g.font = `400 26px ${FONT}`;
  g.fillText('Recortes, filetes e caixas de piso,', 64, 500);
  g.fillText('com as medidas da trena.', 64, 536);
  g.fillStyle = C.fita;
  g.fillRect(64, 566, 6, 30);
  g.fillStyle = C.grafite2;
  g.font = `500 22px ${FONT}`;
  g.fillText('assentador-de-piso.vercel.app', 82, 589);

  // planta de exemplo com o piso
  const project = sampleProject();
  const rooms = roomsInCm(project);
  const { tile, layout } = project.floors[0];
  const result = computeLayout(rooms, tile, layout, Object.fromEntries(rooms.map((r) => [r.id, SAMPLE_ORIGIN])));
  const b = bbox(project.rooms.map((r) => r.polygonPx));
  const k = 0.6;
  const ox = 1140 - b.w * k - b.x * k;
  const oy = 120 - b.y * k;

  // trena
  const tx = ox + b.x * k;
  const ty = oy + b.y * k - 46;
  g.fillStyle = C.fita;
  g.strokeStyle = C.fitaEscura;
  g.lineWidth = 1.5;
  g.fillRect(tx, ty, b.w * k, 30);
  g.strokeRect(tx, ty, b.w * k, 30);
  g.strokeStyle = C.grafite;
  g.lineWidth = 1.4;
  g.fillStyle = C.grafite;
  g.font = `700 13px ${FONT}`;
  g.textAlign = 'right';
  for (let cm = 0; cm <= b.w; cm += 10) {
    const len = cm % 100 === 0 ? 15 : cm % 50 === 0 ? 10 : 6;
    g.beginPath();
    g.moveTo(tx + cm * k, ty);
    g.lineTo(tx + cm * k, ty + len);
    g.stroke();
    if (cm % 100 === 0 && cm > 0 && cm < b.w - 60) g.fillText(String(cm / 100), tx + cm * k - 3, ty + 26);
  }
  g.font = `800 15px ${FONT}`;
  g.fillText('8,00 m', tx + b.w * k - 5, ty + 26);

  for (const r of project.rooms.filter((r) => !r.receivesTile)) {
    path(g, r.polygonPx, k, ox, oy);
    g.fillStyle = '#fafbfa';
    g.fill();
  }
  for (const r of rooms) {
    path(g, r.ring, k, ox, oy);
    g.fillStyle = C.rejunte;
    g.fill();
  }
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1;
  for (const p of result.pieces) {
    for (const ring of p.shape) {
      path(g, ring, k, ox, oy);
      g.fillStyle = pieceFill(p);
      g.fill();
      g.stroke();
    }
  }
  g.strokeStyle = C.grafite;
  g.lineWidth = 3.5;
  for (const r of project.rooms) {
    path(g, r.polygonPx, k, ox, oy);
    g.stroke();
  }

  // porta
  g.beginPath();
  g.arc(ox + SAMPLE_DOOR.x * k, oy + SAMPLE_DOOR.y * k, 9, 0, Math.PI * 2);
  g.fillStyle = C.fita;
  g.fill();
  g.lineWidth = 2.5;
  g.stroke();

  writeFileSync('public/og.png', c.toBuffer('image/png'));
}

function icons() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${C.grafite}"/>
  <rect x="6" y="6" width="9" height="9" fill="${C.inteira}"/>
  <rect x="17" y="6" width="9" height="9" fill="${C.fita}"/>
  <rect x="6" y="17" width="9" height="9" fill="${C.inteira}"/>
  <rect x="17" y="17" width="9" height="9" fill="${C.inteira}"/>
</svg>
`;
  writeFileSync('public/favicon.svg', svg);

  const c = createCanvas(180, 180);
  const g = c.getContext('2d');
  g.fillStyle = C.grafite;
  g.fillRect(0, 0, 180, 180);
  brandMark(g, 36, 36, 108);
  writeFileSync('public/apple-touch-icon.png', c.toBuffer('image/png'));
}

og();
icons();
console.log('public/og.png, public/favicon.svg e public/apple-touch-icon.png gerados');
