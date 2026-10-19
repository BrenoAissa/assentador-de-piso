import { describe, expect, it } from 'vitest';
import { rectRing } from '../tiling/testUtils';
import { estimateScale } from './scale';

describe('estimateScale', () => {
  it('medidas coerentes → mediana correta', () => {
    // 2 px/cm: 640×900 px = 3,20 × 4,50 m
    const { scale, mismatched } = estimateScale([
      { polygonPx: rectRing(0, 0, 640, 900), dims: { a: 3.2, b: 4.5 } },
      { polygonPx: rectRing(0, 0, 400, 300), dims: { a: 1.5, b: 2.0 } }, // orientação trocada
      { polygonPx: rectRing(0, 0, 500, 500), areaM2: 6.25 },
    ]);
    expect(scale).not.toBeNull();
    expect(scale!.pxPerCm).toBeCloseTo(2, 3);
    expect(scale!.source).toBe('ocr');
    expect(mismatched).toEqual([]);
  });

  it('medida discrepante aponta o cômodo', () => {
    const { scale, mismatched } = estimateScale([
      { polygonPx: rectRing(0, 0, 640, 900), dims: { a: 3.2, b: 4.5 } },
      { polygonPx: rectRing(0, 0, 400, 400), dims: { a: 2.0, b: 2.0 } },
      { polygonPx: rectRing(0, 0, 600, 600), dims: { a: 2.0, b: 2.0 } }, // daria 3 px/cm
    ]);
    expect(scale!.pxPerCm).toBeCloseTo(2, 3);
    expect(mismatched).toEqual([2]);
  });

  it('medidas que não batem entre largura e altura são descartadas', () => {
    const { scale } = estimateScale([{ polygonPx: rectRing(0, 0, 640, 900), dims: { a: 3.2, b: 2.0 } }]);
    expect(scale).toBeNull();
  });

  it('cotas lineares: maior cota de cada eixo; cota parcial não atrapalha', () => {
    // 2 px/cm. Quarto 3,31 × 2,41 m com uma cota parcial de 2,35 m; outro quarto 3,31 m; corredor 0,96 m
    const { scale, mismatched } = estimateScale([
      {
        polygonPx: rectRing(0, 0, 662, 482),
        linear: [
          { valueM: 2.35, vertical: false },
          { valueM: 2.41, vertical: true },
        ],
      },
      { polygonPx: rectRing(0, 0, 662, 432), linear: [{ valueM: 3.31, vertical: false }] },
      { polygonPx: rectRing(0, 0, 192, 200), linear: [{ valueM: 0.96, vertical: false }] },
    ]);
    expect(scale!.pxPerCm).toBeCloseTo(2, 1);
    expect(Math.abs(scale!.pxPerCm - 2) / 2).toBeLessThan(0.02);
    expect(mismatched).toEqual([]);
  });

  it('cômodo em L não entra nas cotas lineares', () => {
    const lRoom = [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 300 },
      { x: 400, y: 300 },
      { x: 400, y: 600 },
      { x: 0, y: 600 },
    ];
    expect(estimateScale([{ polygonPx: lRoom, linear: [{ valueM: 2.21, vertical: false }] }]).scale).toBeNull();
  });

  it('cômodo cujo contorno não bate com nenhuma cota é apontado', () => {
    const { mismatched } = estimateScale([
      { polygonPx: rectRing(0, 0, 662, 482), linear: [{ valueM: 3.31, vertical: false }] },
      { polygonPx: rectRing(0, 0, 662, 432), linear: [{ valueM: 3.31, vertical: false }] },
      { polygonPx: rectRing(0, 0, 300, 200), linear: [{ valueM: 2.21, vertical: false }] }, // contorno estreito demais
    ]);
    expect(mismatched).toEqual([2]);
  });

  it('sem estimativas → escala nula, sem erro', () => {
    expect(estimateScale([{ polygonPx: rectRing(0, 0, 100, 100) }])).toEqual({ scale: null, mismatched: [] });
    expect(estimateScale([])).toEqual({ scale: null, mismatched: [] });
  });
});
