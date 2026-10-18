import { describe, expect, it } from 'vitest';
import { rectRing } from '../tiling/testUtils';
import { calibrationScale, insertVertex, nearestEdge, removeVertex, roomSizeLabel } from './ops';

const sq = rectRing(0, 0, 100, 100);

describe('insertVertex', () => {
  it('insere depois do início da aresta', () => {
    const r = insertVertex(sq, 1, { x: 100, y: 50 });
    expect(r).toHaveLength(5);
    expect(r[2]).toEqual({ x: 100, y: 50 });
  });
});

describe('removeVertex', () => {
  it('remove o vértice', () => {
    expect(removeVertex(sq, 0)).toHaveLength(3);
  });

  it('nunca deixa menos de 3 vértices', () => {
    const tri = sq.slice(0, 3);
    expect(removeVertex(tri, 0)).toEqual(tri);
  });
});

describe('nearestEdge', () => {
  it('acha a aresta da direita e o pé da perpendicular', () => {
    const e = nearestEdge(sq, { x: 104, y: 30 });
    expect(e.index).toBe(1);
    expect(e.dist).toBeCloseTo(4);
    expect(e.foot).toEqual({ x: 100, y: 30 });
  });
});

describe('calibrationScale', () => {
  it('300 px para 150 cm dá 2 px/cm', () => {
    expect(calibrationScale({ x: 0, y: 0 }, { x: 300, y: 0 }, 150)).toBe(2);
  });

  it('funciona na diagonal', () => {
    expect(calibrationScale({ x: 0, y: 0 }, { x: 30, y: 40 }, 25)).toBe(2);
  });
});

describe('roomSizeLabel', () => {
  it('medidas e área com vírgula decimal', () => {
    // 640×900 px a 2 px/cm = 3,20 × 4,50 m
    expect(roomSizeLabel(rectRing(0, 0, 640, 900), 2)).toBe('3,20 × 4,50 m (14,4 m²)');
  });
});
