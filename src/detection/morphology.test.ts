import { describe, expect, it } from 'vitest';
import { binarize, otsu, toGray } from './binarize';
import { labelComponents, fillHoles } from './components';
import { traceContour } from './contour';
import { dilate, erode, open } from './morphology';
import { estimateWallThickness } from './thickness';
import { fillRect, frame, line, makeMask, maskToImage } from './synthetic';

const count = (d: Uint8Array) => d.reduce((s, v) => s + v, 0);

describe('binarização', () => {
  it('Otsu separa tinta escura de fundo branco', () => {
    const m = makeMask(50, 50);
    fillRect(m, 10, 10, 20, 20);
    const g = toGray(maskToImage(m));
    const bin = binarize(g, otsu(g));
    expect(count(bin.data)).toBe(400);
  });
});

describe('morfologia', () => {
  it('abertura apaga linha de 1 px e mantém parede de 10 px', () => {
    const m = makeMask(100, 100);
    fillRect(m, 10, 40, 80, 10);
    line(m, 10, 80, 90, 80);
    const o = open(m, 6);
    expect(o.data[45 * 100 + 50]).toBe(1);
    expect(o.data[80 * 100 + 50]).toBe(0);
    expect(count(o.data)).toBe(800);
  });

  it('erosão seguida de dilatação devolve o retângulo', () => {
    const m = makeMask(40, 40);
    fillRect(m, 5, 5, 20, 12);
    expect(dilate(erode(m, 3, 3), 3, 3).data).toEqual(m.data);
  });
});

describe('espessura da parede', () => {
  it('moldura de 10 px com móveis em traço fino → 10', () => {
    const m = makeMask(300, 200);
    frame(m, 10, 10, 280, 180, 10);
    line(m, 50, 50, 200, 50);
    line(m, 50, 50, 50, 150);
    expect(estimateWallThickness(m)).toBe(10);
  });
});

describe('componentes e contorno', () => {
  it('rotula regiões brancas e marca as que tocam a borda', () => {
    const m = makeMask(60, 40);
    frame(m, 5, 5, 50, 30, 3);
    const { stats } = labelComponents(m, 0);
    expect(stats.filter((s) => !s.touchesBorder)).toHaveLength(1);
    expect(stats.find((s) => !s.touchesBorder)!.area).toBe(44 * 24);
  });

  it('preenche buracos internos', () => {
    const m = makeMask(20, 20);
    fillRect(m, 2, 2, 16, 16);
    fillRect(m, 8, 8, 4, 4, 0);
    expect(count(fillHoles(m).data)).toBe(256);
  });

  it('contorno pelos cantos dos pixels dá o retângulo exato', () => {
    const m = makeMask(30, 30);
    fillRect(m, 5, 7, 10, 4);
    expect(traceContour(m)).toEqual([
      { x: 5, y: 7 },
      { x: 15, y: 7 },
      { x: 15, y: 11 },
      { x: 5, y: 11 },
    ]);
  });

  it('contorno de um L tem 6 vértices', () => {
    const m = makeMask(30, 30);
    fillRect(m, 0, 0, 20, 10);
    fillRect(m, 0, 10, 10, 10);
    expect(traceContour(m)).toHaveLength(6);
  });
});
