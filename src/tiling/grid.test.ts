import { describe, expect, it } from 'vitest';
import { pitch, rowShift, tileRects } from './grid';
import { layout, tile } from './testUtils';

describe('pitch', () => {
  it('passo inclui o rejunte em cm', () => {
    expect(pitch(tile({ lengthCm: 60, widthCm: 30, jointMm: 2 }))).toEqual({
      L: 60,
      W: 30,
      joint: 0.2,
      px: 60.2,
      py: 30.2,
    });
  });
});

describe('rowShift', () => {
  it('reta não desloca', () => {
    expect(rowShift(3, layout({ pattern: 'straight' }), 60)).toBe(0);
  });

  it('amarração 1/2 alterna 0 e meio passo', () => {
    const l = layout({ pattern: 'running', runningOffset: { kind: 'fraction', value: 0.5 } });
    expect(rowShift(0, l, 60.2)).toBeCloseTo(0);
    expect(rowShift(1, l, 60.2)).toBeCloseTo(30.1);
    expect(rowShift(2, l, 60.2)).toBeCloseTo(0);
  });

  it('amarração 1/3 repete exatamente a cada 3 fileiras', () => {
    const l = layout({ pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 3 } });
    expect(rowShift(3, l, 60.2)).toBeCloseTo(0, 9);
    expect(rowShift(4, l, 60.2)).toBeCloseTo(rowShift(1, l, 60.2), 9);
    expect(rowShift(6, l, 60.2)).toBeCloseTo(0, 9);
  });

  it('deslocamento em cm', () => {
    const l = layout({ pattern: 'running', runningOffset: { kind: 'cm', value: 40 } });
    expect(rowShift(1, l, 120)).toBeCloseTo(40);
    expect(rowShift(2, l, 120)).toBeCloseTo(80);
    expect(rowShift(3, l, 120)).toBeCloseTo(0);
  });

  it('fileira negativa fica no intervalo [0, passo)', () => {
    const l = layout({ pattern: 'running', runningOffset: { kind: 'fraction', value: 0.5 } });
    expect(rowShift(-1, l, 60)).toBeCloseTo(30);
  });
});

describe('tileRects', () => {
  it('cobre todos os cantos da área (sem rejunte)', () => {
    const bounds = { x: 13, y: 7, w: 250, h: 190 };
    const rects = tileRects(bounds, { x: 0, y: 0 }, tile({ jointMm: 0 }), layout({ pattern: 'running' }));
    const corners = [
      { x: bounds.x + 0.01, y: bounds.y + 0.01 },
      { x: bounds.x + bounds.w - 0.01, y: bounds.y + 0.01 },
      { x: bounds.x + 0.01, y: bounds.y + bounds.h - 0.01 },
      { x: bounds.x + bounds.w - 0.01, y: bounds.y + bounds.h - 0.01 },
    ];
    for (const p of corners) {
      const hit = rects.some(
        ({ rect }) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h,
      );
      expect(hit).toBe(true);
    }
  });

  it('não gera retângulos totalmente fora da área', () => {
    const bounds = { x: 0, y: 0, w: 120, h: 120 };
    const rects = tileRects(bounds, { x: 0, y: 0 }, tile({ jointMm: 0 }), layout());
    expect(rects).toHaveLength(4);
  });
});
