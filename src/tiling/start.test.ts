import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { computeLayout } from './engine';
import { startOrigin } from './start';
import { layout, rectRoom, tile } from './testUtils';
import type { LayoutResult, LayoutSpec, RoomCm, TileSpec } from './types';

function solveFrom(rooms: RoomCm[], t: TileSpec, l: LayoutSpec, p: Point): LayoutResult {
  const o = startOrigin(rooms, t, l, p);
  return computeLayout(rooms, t, { ...l, origin: o }, Object.fromEntries(rooms.map((r) => [r.id, o])));
}

const pieceAt = (res: LayoutResult, q: Point) => res.pieces.find((p) => p.shape.some((r) => pointInPolygon(q, r)))!;

describe('startOrigin', () => {
  it('porta no meio da parede de baixo: peça inteira centralizada e encostada na parede', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = solveFrom(rooms, tile({ jointMm: 0 }), layout(), { x: 150, y: 300 });
    const p = pieceAt(res, { x: 150, y: 299 });
    expect(p.kind).toBe('full');
    expect(p.tileRect).toEqual({ x: 120, y: 240, w: 60, h: 60 });
  });

  it('entre peça e junta centralizadas na porta, fica a que não deixa filete', () => {
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const res = solveFrom(rooms, tile({ jointMm: 0 }), layout(), { x: 155, y: 300 });
    expect(res.summary.slivers).toBe(0);
    const p = pieceAt(res, { x: 150, y: 299 });
    expect(p.kind).toBe('full');
    expect(p.tileRect.y + p.tileRect.h).toBeCloseTo(300);
  });

  it('porta numa parede vertical alinha a coluna na parede', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = solveFrom(rooms, tile({ jointMm: 0 }), layout(), { x: 0, y: 150 });
    const p = pieceAt(res, { x: 1, y: 150 });
    expect(p.kind).toBe('full');
    expect(p.tileRect.x).toBeCloseTo(0);
  });

  it('longe das paredes: peça centralizada no ponto', () => {
    const rooms = [rectRoom('sala', 0, 0, 400, 400)];
    const res = solveFrom(rooms, tile({ jointMm: 0 }), layout(), { x: 200, y: 200 });
    expect(pieceAt(res, { x: 200, y: 200 }).tileRect).toEqual({ x: 170, y: 170, w: 60, h: 60 });
  });

  it('régua em pé e amarração: a peça da porta é inteira e encosta na parede', () => {
    const rooms = [rectRoom('quarto', 0, 0, 300, 300)];
    const t = tile({ lengthCm: 120, widthCm: 20, jointMm: 0 });
    const l = layout({ rotationDeg: 90, pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 3 } });
    const res = solveFrom(rooms, t, l, { x: 150, y: 300 });
    const p = pieceAt(res, { x: 150, y: 299 });
    expect(p.kind).toBe('full');
    expect(p.tileRect.y + p.tileRect.h).toBeCloseTo(300);
  });

  it('clique na soleira, fora de qualquer cômodo, usa a parede mais próxima', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = solveFrom(rooms, tile({ jointMm: 0 }), layout(), { x: 150, y: 307 });
    const p = pieceAt(res, { x: 150, y: 299 });
    expect(p.kind).toBe('full');
    expect(p.tileRect.y + p.tileRect.h).toBeCloseTo(300);
  });
});
