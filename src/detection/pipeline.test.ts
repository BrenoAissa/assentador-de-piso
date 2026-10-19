import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { bbox } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import { detectRooms } from './pipeline';
import { readGrayPng } from './pngTestUtil';
import { clearRect, fillRect, frame, hatchedRect, line, makeMask, maskToImage, paintRGB } from './synthetic';

/** Moldura 400×300 (paredes de 10 px) com uma parede vertical e uma horizontal: 3 cômodos. */
function threeRooms() {
  const m = makeMask(400, 300);
  frame(m, 20, 20, 360, 260, 10);
  fillRect(m, 180, 30, 10, 240); // vertical
  fillRect(m, 190, 140, 180, 10); // horizontal à direita
  return m;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 2;

function hasRect(rooms: { polygonPx: Ring }[], x0: number, y0: number, x1: number, y1: number) {
  return rooms.some((r) => {
    const b = bbox(r.polygonPx);
    return near(b.x, x0) && near(b.y, y0) && near(b.x + b.w, x1) && near(b.y + b.h, y1) && r.polygonPx.length === 4;
  });
}

describe('detectRooms', () => {
  it('3 cômodos retangulares com os cantos certos', () => {
    const res = detectRooms(maskToImage(threeRooms()));
    expect(res.rooms).toHaveLength(3);
    expect(res.wallThicknessPx).toBe(10);
    expect(hasRect(res.rooms, 30, 30, 180, 270)).toBe(true);
    expect(hasRect(res.rooms, 190, 30, 370, 140)).toBe(true);
    expect(hasRect(res.rooms, 190, 150, 370, 270)).toBe(true);
  });

  it('vãos de porta são fechados e os cômodos continuam separados', () => {
    const m = threeRooms();
    clearRect(m, 180, 60, 10, 80); // porta na parede vertical
    clearRect(m, 250, 140, 80, 10); // porta na parede horizontal
    line(m, 190, 60, 250, 120); // folha da porta (traço fino)
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(3);
    expect(hasRect(res.rooms, 30, 30, 180, 270)).toBe(true);
  });

  it('porta encostada numa parede perpendicular também é fechada', () => {
    const m = threeRooms();
    clearRect(m, 190, 140, 80, 10); // vão começa colado na parede vertical
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(3);
  });

  it('louça encostada na parede não estraga o fechamento da porta ao lado', () => {
    const m = makeMask(400, 300);
    frame(m, 20, 20, 360, 260, 10);
    fillRect(m, 180, 30, 10, 240); // parede vertical
    clearRect(m, 180, 60, 10, 50); // porta nela
    fillRect(m, 30, 130, 150, 10); // cômodo de cima baixo (100 px)
    fillRect(m, 150, 30, 30, 15); // bancada/pia encostada na parede de cima e na vertical
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(3);
  });

  it('porta só fecha depois que a passagem vizinha vira parede (duas rodadas)', () => {
    const m = makeMask(400, 300);
    frame(m, 20, 20, 360, 260, 10);
    fillRect(m, 250, 30, 10, 240); // parede vertical com passagem
    clearRect(m, 250, 120, 10, 60);
    fillRect(m, 30, 140, 140, 10); // parede horizontal que termina antes da vertical
    // a porta (170..250) só tem a parede vertical do outro lado depois de fechada a passagem
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(3);
  });

  it('abertura larga vazia fica aberta; janela larga com caixilho é fechada', () => {
    const m = makeMask(400, 300);
    frame(m, 20, 20, 360, 260, 10);
    fillRect(m, 180, 30, 10, 240);
    clearRect(m, 180, 80, 10, 150); // passagem de 150 px (cozinha integrada)
    clearRect(m, 210, 20, 150, 10); // janela de 150 px na parede de cima...
    line(m, 210, 23, 360, 23); // ...com duas linhas de caixilho
    line(m, 210, 26, 360, 26);
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(1);
    const b = bbox(res.rooms[0].polygonPx);
    expect(near(b.x, 30) && near(b.y, 30) && near(b.x + b.w, 370) && near(b.y + b.h, 270)).toBe(true);
  });

  it('corredor de 30 px entre paredes paralelas não é fechado', () => {
    const m = makeMask(400, 300);
    frame(m, 20, 20, 360, 260, 10);
    fillRect(m, 30, 120, 340, 10);
    fillRect(m, 30, 160, 340, 10); // corredor entre y=130 e y=160
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(3);
    expect(hasRect(res.rooms, 30, 130, 370, 160)).toBe(true);
  });

  it('móveis e textos em traço fino não viram parede', () => {
    const m = threeRooms();
    for (let k = 0; k < 5; k++) line(m, 50 + k * 20, 60, 60 + k * 20, 200);
    line(m, 220, 50, 340, 50);
    line(m, 220, 50, 220, 120);
    line(m, 200, 200, 360, 260);
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(3);
    expect(hasRect(res.rooms, 30, 30, 180, 270)).toBe(true);
  });

  it('cômodo em L vira polígono de 6 vértices', () => {
    const m = makeMask(300, 300);
    frame(m, 20, 20, 260, 260, 10);
    fillRect(m, 150, 30, 120, 120); // bloco cheio no canto superior direito
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(1);
    expect(res.rooms[0].polygonPx).toHaveLength(6);
  });

  it('paredes desenhadas só com contorno (duas linhas) também funcionam', () => {
    const m = makeMask(400, 300);
    // contorno externo e interno da moldura
    for (const [x, y, w, h] of [
      [20, 20, 360, 260],
      [30, 30, 340, 240],
    ]) {
      line(m, x, y, x + w, y);
      line(m, x + w, y, x + w, y + h);
      line(m, x + w, y + h, x, y + h);
      line(m, x, y + h, x, y);
    }
    // parede vertical em contorno
    line(m, 180, 30, 180, 270);
    line(m, 190, 30, 190, 270);
    const res = detectRooms(maskToImage(m));
    expect(res.mode).toBe('outline');
    expect(res.rooms).toHaveLength(2);
  });

  it('parede interna com metade da espessura da externa sobrevive', () => {
    const m = makeMask(400, 300);
    frame(m, 20, 20, 360, 260, 16);
    fillRect(m, 196, 36, 8, 228); // interna de 8 px
    const res = detectRooms(maskToImage(m));
    expect(res.rooms).toHaveLength(2);
  });

  it('planta de exemplo (portas, janelas e móveis) → 7 cômodos', () => {
    const res = detectRooms(readGrayPng('public/exemplo-planta.png'));
    expect(res.rooms).toHaveLength(7);
    // sala: interior de 115..1190 × 115..990 px (2 px/cm, margem de 100 px)
    expect(hasRect(res.rooms, 115, 115, 1190, 990)).toBe(true);
  });

  it('paredes hachuradas, cotas dentro dos cômodos e faixa colorida → 3 cômodos', () => {
    const m = makeMask(420, 320);
    // moldura hachurada de 12 px e paredes internas hachuradas
    hatchedRect(m, 30, 30, 360, 12);
    hatchedRect(m, 30, 278, 360, 12);
    hatchedRect(m, 30, 30, 12, 260);
    hatchedRect(m, 378, 30, 12, 260);
    hatchedRect(m, 190, 42, 10, 236);
    hatchedRect(m, 200, 150, 178, 10);
    // linhas de cota de 1 px a ~10 px das paredes, com tracinhos nas pontas
    line(m, 42, 55, 190, 55);
    line(m, 55, 42, 55, 278);
    line(m, 200, 170, 378, 170);
    for (const x of [42, 190]) line(m, x - 3, 52, x + 3, 58);
    const img = maskToImage(m);
    paintRGB(img, 0, 0, 120, 25, [214, 176, 0]); // faixa amarela no canto
    const res = detectRooms(img);
    expect(res.rooms).toHaveLength(3);
    expect(hasRect(res.rooms, 42, 42, 190, 278)).toBe(true);
    expect(hasRect(res.rooms, 200, 42, 378, 150)).toBe(true);
    expect(hasRect(res.rooms, 200, 160, 378, 278)).toBe(true);
  });

  // Planta real do usuário: fica só na máquina dele (planta-real/ é ignorada pelo git).
  const realPlan = 'planta-real/pagina-1.png';
  it.skipIf(!existsSync(realPlan))('planta real (paredes hachuradas, documento com logotipos) → cômodos principais', async () => {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const img = await loadImage(realPlan);
    const f = 1600 / Math.max(img.width, img.height);
    const c = createCanvas(Math.round(img.width * f), Math.round(img.height * f));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data as unknown as Uint8ClampedArray;
    const res = detectRooms({ width: c.width, height: c.height, data });
    const boxes = res.rooms.map((r) => bbox(r.polygonPx));
    const hasBox = (x0: number, y0: number, x1: number, y1: number) =>
      boxes.some((b) => Math.abs(b.x - x0) <= 4 && Math.abs(b.y - y0) <= 4 && Math.abs(b.x + b.w - x1) <= 4 && Math.abs(b.y + b.h - y1) <= 4);
    expect(res.rooms.length).toBeGreaterThanOrEqual(6);
    expect(hasBox(311, 525, 545, 696)).toBe(true); // quarto 1
    expect(hasBox(310, 799, 546, 958)).toBe(true); // quarto 2
    expect(hasBox(558, 680, 821, 958)).toBe(true); // sala + cozinha
    expect(hasBox(575, 600, 713, 666)).toBe(true); // área de serviço
  });

  it('planta vazia não quebra e avisa', () => {
    const res = detectRooms(maskToImage(makeMask(200, 200)));
    expect(res.rooms).toEqual([]);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});
