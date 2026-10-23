import { describe, expect, it } from 'vitest';
import { computeLayout, solveLayout } from './engine';
import { floorResult, mergeFloors, replaceFloor, solveFloors } from './floors';
import { layout, rectRoom, tile } from './testUtils';
import type { FloorInput } from './types';

// dois cômodos lado a lado, cada um com o seu piso
const A: FloorInput = { id: 'A', tile: tile({ lengthCm: 60, widthCm: 60, jointMm: 0 }), layout: layout(), rooms: [rectRoom('cozinha', 0, 0, 310, 300)] };
const B: FloorInput = { id: 'B', tile: tile({ lengthCm: 90, widthCm: 90, jointMm: 0 }), layout: layout(), rooms: [rectRoom('sala', 310, 0, 310, 300)] };

describe('cálculo por piso', () => {
  it('junta as peças dos dois pisos, cada uma com o seu piso e número único', () => {
    const res = solveFloors([A, B]);
    const ns = res.pieces.map((p) => p.n);
    expect(new Set(ns).size).toBe(ns.length);
    expect(Math.min(...ns)).toBe(1);
    expect(Math.max(...ns)).toBe(ns.length);
    expect(res.pieces.filter((p) => p.roomId === 'cozinha').every((p) => p.floorId === 'A')).toBe(true);
    expect(res.pieces.filter((p) => p.roomId === 'sala').every((p) => p.floorId === 'B')).toBe(true);
  });

  it('sobra de um piso nunca vira peça do outro', () => {
    const res = solveFloors([A, B]);
    const floorOfN = new Map(res.pieces.map((p) => [p.n, p.floorId]));
    for (const p of res.pieces) {
      if (p.fromLeftoverOf !== undefined) expect(floorOfN.get(p.fromLeftoverOf)).toBe(p.floorId);
    }
    expect(res.pieces.some((p) => p.fromLeftoverOf !== undefined)).toBe(true);
  });

  it('a compra de cada piso é a do piso calculado sozinho', () => {
    const res = solveFloors([A, B]);
    expect(floorResult(res, 'A')!.summary).toEqual(solveLayout(A.rooms, A.tile, A.layout).summary);
    expect(floorResult(res, 'B')!.summary).toEqual(solveLayout(B.rooms, B.tile, B.layout).summary);
  });

  it('trocar o resultado de um piso não mexe nas peças do outro', () => {
    const res = solveFloors([A, B]);
    const outro = computeLayout(A.rooms, A.tile, A.layout, { cozinha: { x: 17, y: 23 } });
    const next = replaceFloor(res, 'A', outro);
    const sala = (r: typeof res) => r.pieces.filter((p) => p.floorId === 'B').map((p) => ({ key: p.key, shape: p.shape, kind: p.kind }));
    expect(sala(next)).toEqual(sala(res));
    expect(floorResult(next, 'A')).toBe(outro);
  });

  it('mergeFloors renumera a sobra junto com as peças', () => {
    const a = solveLayout(A.rooms, A.tile, A.layout);
    const b = solveLayout(B.rooms, B.tile, B.layout);
    const res = mergeFloors([{ floorId: 'A', result: a }, { floorId: 'B', result: b }]);
    const firstB = res.pieces.find((p) => p.floorId === 'B')!;
    expect(firstB.n).toBe(a.pieces.length + b.pieces[0].n);
  });
});
