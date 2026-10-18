// Diagnóstico da detecção numa imagem: imprime o resultado e salva máscaras intermediárias.
// Uso: npx vite-node scripts/debug-detect.ts <imagem.png> <pasta-de-saída>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { densityMask, inkMask, sandwiched } from '../src/detection/binarize';
import { open } from '../src/detection/morphology';
import { fillSmallHoles, removeSmall } from '../src/detection/components';
import { closeGaps } from '../src/detection/gaps';
import { fillOutlineWalls } from '../src/detection/outline';
import { detectRooms } from '../src/detection/pipeline';
import { estimateWallThickness } from '../src/detection/thickness';
import type { Mask } from '../src/detection/types';

const [, , input, outDir] = process.argv;
const img = await loadImage(input);
const f = Math.min(1, 1600 / Math.max(img.width, img.height));
const w = Math.round(img.width * f);
const h = Math.round(img.height * f);
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, w, h);
ctx.drawImage(img, 0, 0, w, h);
const data = ctx.getImageData(0, 0, w, h);
const rgba = { width: w, height: h, data: data.data as unknown as Uint8ClampedArray };

function saveMask(m: Mask, name: string) {
  const c = createCanvas(m.w, m.h);
  const x = c.getContext('2d');
  const id = x.createImageData(m.w, m.h);
  for (let i = 0; i < m.w * m.h; i++) {
    const v = m.data[i] ? 0 : 255;
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  writeFileSync(join(outDir, name), c.toBuffer('image/png'));
}



const ink = inkMask(rgba);
const solid = sandwiched(ink, densityMask(ink, 7, 0.25), 3);
saveMask(solid, 'dbg-1b-solido.png');
{
  const t0 = estimateWallThickness(solid);
  const filledHoles = fillSmallHoles(solid, t0 * t0);
  const t = estimateWallThickness(filledHoles);
  const walls = removeSmall(open(filledHoles, Math.ceil(0.45 * t)), 12 * t * t);
  saveMask(walls, 'dbg-6-paredes.png');
  saveMask(closeGaps(walls, ink, t, { maxOpen: 9 * t, maxFramed: 25 * t }).closed, 'dbg-7-vaos-fechados.png');
}
saveMask(ink, 'dbg-1-tinta.png');
const tFilled = estimateWallThickness(ink);
const outline = fillOutlineWalls(ink);
saveMask(outline, 'dbg-2-contorno-preenchido.png');
const tOutline = estimateWallThickness(outline);
saveMask(open(ink, Math.ceil(0.45 * Math.max(tFilled, 3))), 'dbg-3-paredes-cheias.png');
saveMask(open(outline, Math.ceil(0.45 * Math.max(tOutline, 3))), 'dbg-4-paredes-contorno.png');
console.log({ size: [w, h], scaleFromOriginal: f, tFilled, tSolid: estimateWallThickness(solid), tOutline });

const t0 = Date.now();
const res = detectRooms(rgba);
console.log({ ms: Date.now() - t0, mode: res.mode, t: res.wallThicknessPx, warnings: res.warnings });
for (const r of res.rooms) {
  const xs = r.polygonPx.map((p) => p.x);
  const ys = r.polygonPx.map((p) => p.y);
  console.log(
    `cômodo: ${r.polygonPx.length} vértices, caixa ${Math.min(...xs).toFixed(0)},${Math.min(...ys).toFixed(0)} → ${Math.max(...xs).toFixed(0)},${Math.max(...ys).toFixed(0)}, confiança ${r.confidence.toFixed(2)}`,
  );
}

// sobreposição dos cômodos encontrados na imagem reduzida
ctx.lineWidth = 2;
for (const r of res.rooms) {
  ctx.fillStyle = 'rgba(79,134,198,0.35)';
  ctx.strokeStyle = '#d9493b';
  ctx.beginPath();
  r.polygonPx.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
writeFileSync(join(outDir, 'dbg-5-comodos.png'), canvas.toBuffer('image/png'));
