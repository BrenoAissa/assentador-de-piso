import { describe, expect, it } from 'vitest';
import { rectRing } from '../tiling/testUtils';
import { ringsToShapes, wallSegments } from './geometry';

describe('wallSegments', () => {
  it('quadrado 100×100: 4 paredes por fora, estendidas para fechar os cantos', () => {
    const segs = wallSegments(rectRing(0, 0, 100, 100), 10);
    expect(segs).toHaveLength(4);
    for (const s of segs) expect(s.length).toBeCloseTo(110);
    const centers = segs.map((s) => [Math.round(s.cx), Math.round(s.cz)]);
    expect(centers).toEqual(
      expect.arrayContaining([
        [50, -5],
        [105, 50],
        [50, 105],
        [-5, 50],
      ]),
    );
  });

  it('funciona com o anel em sentido inverso', () => {
    const segs = wallSegments(rectRing(0, 0, 100, 100).reverse(), 10);
    const centers = segs.map((s) => [Math.round(s.cx), Math.round(s.cz)]);
    expect(centers).toEqual(expect.arrayContaining([[50, -5], [-5, 50]]));
  });

  it('ângulo da parede horizontal é 0 e da vertical é ±90°', () => {
    const segs = wallSegments(rectRing(0, 0, 100, 100), 10);
    const top = segs.find((s) => Math.round(s.cz) === -5)!;
    const left = segs.find((s) => Math.round(s.cx) === -5)!;
    expect(Math.abs(Math.sin(top.angle))).toBeCloseTo(0);
    expect(Math.abs(Math.sin(left.angle))).toBeCloseTo(1);
  });
});

describe('ringsToShapes', () => {
  it('um Shape por anel, com y invertido para deitar no chão', () => {
    const shapes = ringsToShapes([rectRing(0, 0, 60, 30), rectRing(100, 0, 10, 10)]);
    expect(shapes).toHaveLength(2);
    const pts = shapes[0].getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(4);
    expect(pts.some((p) => p.x === 60 && p.y === -30)).toBe(true);
  });
});
