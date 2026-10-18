import { describe, expect, it } from 'vitest';
import { assignLeftovers } from './leftovers';
import { layout } from './testUtils';
import type { Piece } from './types';

// Régua 120×20 no referencial da paginação; corte em x.
function cutX(n: number, w: number): Piece {
  return {
    n,
    roomId: 'a',
    row: n,
    col: 0,
    tileRect: { x: 0, y: n * 20, w: 120, h: 20 },
    shape: [],
    kind: 'cut',
    cutType: 'straight',
    cutSize: { w, h: 20 },
  };
}

const l = layout({ kerfCm: 0.3, minCutCm: 5, minCutFraction: 1 / 3 });

describe('assignLeftovers', () => {
  it('recorte de 45 sai da sobra do recorte de 70', () => {
    const pieces = [cutX(1, 70), cutX(2, 45)];
    assignLeftovers(pieces, 120, 20, l);
    expect(pieces[0].fromLeftoverOf).toBeUndefined();
    expect(pieces[1].fromLeftoverOf).toBe(1);
  });

  it('cada sobra é usada uma vez só', () => {
    const pieces = [cutX(1, 70), cutX(2, 45), cutX(3, 45)];
    assignLeftovers(pieces, 120, 20, l);
    expect(pieces.filter((p) => p.fromLeftoverOf === 1)).toHaveLength(1);
    expect(pieces.some((p) => p.fromLeftoverOf === 3 || p.fromLeftoverOf === 2)).toBe(false);
  });

  it('sobra que seria filete não entra no estoque', () => {
    // 120 − 100 − 0,3 = 19,7 < 40 (1/3 de 120)
    const pieces = [cutX(1, 100), cutX(2, 15)];
    assignLeftovers(pieces, 120, 20, l);
    expect(pieces[1].fromLeftoverOf).toBeUndefined();
  });

  it('peças inteiras e recortes irregulares não participam', () => {
    const full: Piece = { ...cutX(1, 120), kind: 'full', cutType: undefined, cutSize: undefined };
    const shaped: Piece = { ...cutX(2, 50), cutType: 'shaped' };
    const pieces = [full, shaped];
    assignLeftovers(pieces, 120, 20, l);
    expect(pieces.every((p) => p.fromLeftoverOf === undefined)).toBe(true);
  });
});
