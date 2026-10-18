import { describe, expect, it } from 'vitest';
import { bbox } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import { detectRooms } from './pipeline';
import { readGrayPng } from './pngTestUtil';
import { clearRect, fillRect, frame, line, makeMask, maskToImage } from './synthetic';

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

  it('planta vazia não quebra e avisa', () => {
    const res = detectRooms(maskToImage(makeMask(200, 200)));
    expect(res.rooms).toEqual([]);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});
