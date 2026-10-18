import { describe, expect, it } from 'vitest';
import {
  bbox,
  cleanRing,
  isAxisRect,
  isSimple,
  pointInPolygon,
  polygonArea,
  scaleRing,
  signedArea,
  swapXY,
} from './polygon';
import type { Ring } from './types';

const square: Ring = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 300 },
  { x: 0, y: 300 },
];

// L: 400×300 sem o quadrado superior direito 200×150
const lShape: Ring = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 150 },
  { x: 400, y: 150 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];

describe('polygonArea', () => {
  it('quadrado 300×300 tem área 90000', () => {
    expect(polygonArea(square)).toBe(90000);
  });

  it('é positiva nos dois sentidos de orientação', () => {
    expect(polygonArea([...square].reverse())).toBe(90000);
    expect(Math.sign(signedArea(square))).toBe(-Math.sign(signedArea([...square].reverse())));
  });

  it('L tem área 400·300 − 200·150', () => {
    expect(polygonArea(lShape)).toBe(400 * 300 - 200 * 150);
  });
});

describe('bbox', () => {
  it('caixa envolvente do L', () => {
    expect(bbox(lShape)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  it('aceita vários anéis', () => {
    const other: Ring = [
      { x: 500, y: -10 },
      { x: 520, y: -10 },
      { x: 520, y: 5 },
    ];
    expect(bbox([lShape, other])).toEqual({ x: 0, y: -10, w: 520, h: 310 });
  });
});

describe('isAxisRect', () => {
  it('retângulo com ponto colinear extra é retângulo', () => {
    const withMid: Ring = [
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(isAxisRect(withMid)).toBe(true);
  });

  it('L não é retângulo', () => {
    expect(isAxisRect(lShape)).toBe(false);
  });

  it('losango não é retângulo alinhado', () => {
    expect(
      isAxisRect([
        { x: 0, y: 50 },
        { x: 50, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 100 },
      ]),
    ).toBe(false);
  });
});

describe('pointInPolygon', () => {
  it('dentro do L', () => {
    expect(pointInPolygon({ x: 100, y: 100 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 300, y: 250 }, lShape)).toBe(true);
  });

  it('no recorte do L fica fora', () => {
    expect(pointInPolygon({ x: 300, y: 50 }, lShape)).toBe(false);
  });
});

describe('isSimple', () => {
  it('gravata borboleta não é simples', () => {
    expect(
      isSimple([
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ]),
    ).toBe(false);
  });

  it('L é simples', () => {
    expect(isSimple(lShape)).toBe(true);
  });

  it('menos de 3 pontos distintos não é simples', () => {
    expect(isSimple([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }])).toBe(false);
  });
});

describe('cleanRing', () => {
  it('vértices duplicados e colineares não mudam a área', () => {
    const messy: Ring = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
      { x: 0, y: 0 },
    ];
    const clean = cleanRing(messy);
    expect(clean).toHaveLength(4);
    expect(polygonArea(clean)).toBe(90000);
  });
});

describe('swapXY e scaleRing', () => {
  it('swapXY troca coordenadas', () => {
    expect(swapXY([{ x: 1, y: 2 }])).toEqual([{ x: 2, y: 1 }]);
  });

  it('scaleRing multiplica coordenadas', () => {
    expect(scaleRing([{ x: 10, y: 20 }], 0.5)).toEqual([{ x: 5, y: 10 }]);
  });
});
