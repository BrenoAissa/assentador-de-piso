import { describe, expect, it } from 'vitest';
import { comparePatterns } from './compare';
import { computeLayout } from './engine';
import { compareResults, fastScore, optimizeOrigin } from './optimize';
import { layout, rectRoom, tile } from './testUtils';
import type { LayoutResult } from './types';

const rooms = [rectRoom('sala', 0, 0, 310, 300)];
const t = tile({ jointMm: 2 });

describe('optimizeOrigin', () => {
  it('310×300: a origem escolhida não gera filete', () => {
    const l = layout();
    const o = optimizeOrigin(rooms, t, l);
    const res = computeLayout(rooms, t, l, { sala: o });
    expect(res.summary.slivers).toBe(0);
  });

  it('funciona com rotação de 90° e amarração', () => {
    const l = layout({ rotationDeg: 90, pattern: 'running' });
    const tt = tile({ lengthCm: 120, widthCm: 20, jointMm: 0 });
    const o = optimizeOrigin(rooms, tt, l);
    const res = computeLayout(rooms, tt, l, { sala: o });
    expect(res.summary.slivers).toBe(0);
  });
});

describe('fastScore', () => {
  it('pontua pior a origem que deixa filete de 9 cm', () => {
    const l = layout();
    const bad = fastScore(rooms, t, l, { x: 0, y: 0 });
    const good = fastScore(rooms, t, l, optimizeOrigin(rooms, t, l));
    expect(bad).toBeGreaterThan(good);
  });
});

describe('compareResults', () => {
  const mk = (slivers: number, newTiles: number, cut: number) =>
    ({ summary: { slivers, newTiles, cut } }) as unknown as LayoutResult;

  it('filetes pesam antes da quantidade de peças', () => {
    expect(compareResults(mk(0, 30, 10), mk(1, 20, 5))).toBeLessThan(0);
  });

  it('com os mesmos filetes, menos peças ganha', () => {
    expect(compareResults(mk(0, 20, 10), mk(0, 21, 2))).toBeLessThan(0);
  });

  it('com mesmas peças, menos recortes ganha', () => {
    expect(compareResults(mk(0, 20, 3), mk(0, 20, 4))).toBeLessThan(0);
  });
});

describe('comparePatterns', () => {
  it('compara alinhado, tijolinho e escada', () => {
    const res = comparePatterns(rooms, t, layout());
    expect(res.map((r) => r.label)).toEqual(['Alinhado', 'Tijolinho', 'Escada']);
    expect(res[1].layout.pattern).toBe('running');
    expect(res[2].layout.runningOffset).toEqual({ kind: 'fraction', value: 1 / 3 });
    for (const r of res) expect(r.result.pieces.length).toBeGreaterThan(0);
  });
});
