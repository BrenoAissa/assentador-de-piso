import { describe, expect, it } from 'vitest';
import { densityMask, inkMask, sandwiched } from './binarize';
import { fillRect, hatchedRect, line, makeMask, maskToImage, paintRGB } from './synthetic';

const count = (d: Uint8Array) => d.reduce((s, v) => s + v, 0);

describe('inkMask', () => {
  it('ignora cores saturadas (logotipos, faixas) e mantém traço preto e cinza', () => {
    const m = makeMask(60, 60);
    fillRect(m, 5, 5, 10, 10); // preto
    const img = maskToImage(m);
    paintRGB(img, 30, 5, 20, 20, [214, 176, 0]); // amarelo
    paintRGB(img, 30, 30, 20, 20, [51, 176, 224]); // azul claro
    paintRGB(img, 5, 30, 10, 10, [150, 150, 150]); // cinza de hachura
    const ink = inkMask(img);
    expect(ink.data[10 * 60 + 10]).toBe(1);
    expect(ink.data[35 * 60 + 10]).toBe(1);
    expect(ink.data[10 * 60 + 40]).toBe(0);
    expect(ink.data[40 * 60 + 40]).toBe(0);
  });

  it('cor saturada muito escura ainda conta como tinta', () => {
    const img = maskToImage(makeMask(20, 20));
    paintRGB(img, 5, 5, 10, 10, [10, 20, 70]);
    expect(count(inkMask(img).data)).toBe(100);
  });
});

describe('sandwiched', () => {
  it('parede cheia não engorda: a borda criada pela janela sai', () => {
    const m = makeMask(60, 40);
    fillRect(m, 10, 10, 40, 12);
    const solid = sandwiched(m, densityMask(m, 7, 0.25), 3);
    expect(solid.data).toEqual(m.data);
  });

  it('parede hachurada continua cheia até o contorno', () => {
    const m = makeMask(80, 40);
    hatchedRect(m, 10, 10, 60, 12, 3);
    const solid = sandwiched(m, densityMask(m, 7, 0.25), 3);
    for (let x = 14; x < 66; x++) {
      for (let y = 10; y < 22; y++) expect(solid.data[y * 80 + x]).toBe(1);
      expect(solid.data[9 * 80 + x]).toBe(0);
      expect(solid.data[22 * 80 + x]).toBe(0);
    }
  });
});

describe('densityMask', () => {
  it('parede hachurada vira faixa cheia', () => {
    const m = makeMask(80, 40);
    hatchedRect(m, 10, 10, 60, 12, 3);
    const d = densityMask(m, 7, 0.25);
    for (let x = 14; x < 66; x++) for (let y = 13; y < 19; y++) expect(d.data[y * 80 + x]).toBe(1);
  });

  it('linha isolada de 1 px não passa', () => {
    const m = makeMask(80, 40);
    line(m, 5, 20, 75, 20);
    expect(count(densityMask(m, 7, 0.25).data)).toBe(0);
  });
});
