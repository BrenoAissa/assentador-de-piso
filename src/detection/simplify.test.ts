import { describe, expect, it } from 'vitest';
import { douglasPeucker, orthogonalize } from './simplify';

describe('douglasPeucker', () => {
  it('remove a escadinha de 1 px numa parede quase reta', () => {
    const ring = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 1 },
      { x: 100, y: 1 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ];
    expect(douglasPeucker(ring, 2)).toHaveLength(4);
  });
});

describe('orthogonalize', () => {
  it('endireita arestas com até 5° de inclinação', () => {
    const ring = [
      { x: 0, y: 0 },
      { x: 100, y: 3 },
      { x: 102, y: 80 },
      { x: 1, y: 79 },
    ];
    const r = orthogonalize(ring, 5);
    expect(r[0].y).toBeCloseTo(r[1].y);
    expect(r[1].x).toBeCloseTo(r[2].x);
    expect(r[2].y).toBeCloseTo(r[3].y);
    expect(r[3].x).toBeCloseTo(r[0].x);
  });

  it('mantém arestas realmente inclinadas', () => {
    const ring = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 60, y: 80 },
      { x: 0, y: 80 },
    ];
    const r = orthogonalize(ring, 5);
    expect(r[2].x).toBe(60);
    expect(r[1].x).toBe(100);
  });
});
