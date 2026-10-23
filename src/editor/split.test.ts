import { describe, expect, it } from 'vitest';
import { polygonArea } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import { rectRing } from '../tiling/testUtils';
import { splitRing } from './split';

const pts = (...xy: number[]): Ring => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));

describe('splitRing (dividir cômodo na divisa)', () => {
  it('uma linha reta atravessando o retângulo dá dois cômodos', () => {
    const parts = splitRing(rectRing(0, 0, 400, 300), { x: 250, y: 0 }, { x: 250, y: 300 });
    expect(parts).not.toBeNull();
    const areas = parts!.map(polygonArea).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(45000);
    expect(areas[1]).toBeCloseTo(75000);
  });

  it('linha que não passa pelo cômodo não divide', () => {
    expect(splitRing(rectRing(0, 0, 400, 300), { x: 500, y: 0 }, { x: 500, y: 300 })).toBeNull();
  });

  it('cômodo em L cortado na perna dá dois pedaços', () => {
    const l = pts(0, 0, 400, 0, 400, 100, 100, 100, 100, 300, 0, 300);
    const parts = splitRing(l, { x: 0, y: 50 }, { x: 400, y: 50 });
    expect(parts).not.toBeNull();
    expect(parts!.map(polygonArea).reduce((a, b) => a + b, 0)).toBeCloseTo(polygonArea(l));
  });

  it('linha que deixaria três pedaços (cômodo em U) não divide', () => {
    const u = pts(0, 0, 300, 0, 300, 300, 200, 300, 200, 100, 100, 100, 100, 300, 0, 300);
    expect(splitRing(u, { x: 0, y: 200 }, { x: 300, y: 200 })).toBeNull();
  });

  it('pontos iguais não formam linha', () => {
    expect(splitRing(rectRing(0, 0, 400, 300), { x: 100, y: 0 }, { x: 100, y: 0 })).toBeNull();
  });
});
