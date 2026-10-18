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

  it('sem estimativas → escala nula, sem erro', () => {
    expect(estimateScale([{ polygonPx: rectRing(0, 0, 100, 100) }])).toEqual({ scale: null, mismatched: [] });
    expect(estimateScale([])).toEqual({ scale: null, mismatched: [] });
  });
});
