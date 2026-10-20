import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { computeLayout, solveLayout } from './engine';
import { entrancePiece, entrancePoints, startOrigin } from './start';
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

  it('se centralizar na porta deixaria filete, a peça sai do centro mas continua inteira sob o toque', () => {
    // 310 de largura com a peça centralizada em 155 deixaria tiras de 5 cm nas duas paredes
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const res = solveFrom(rooms, tile({ jointMm: 0 }), layout(), { x: 155, y: 300 });
    expect(res.summary.slivers).toBe(0);
    const p = pieceAt(res, { x: 155, y: 299 });
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

describe('entrada marcada (a peça que a pessoa tocou)', () => {
  const t60 = tile({ jointMm: 0 });

  it('a peça da entrada fica inteira e vale mais que um começo salvo antes', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = solveLayout(rooms, t60, layout({ origin: { x: 7, y: 13 }, start: { x: 150, y: 290 } }));
    const p = pieceAt(res, { x: 150, y: 290 });
    expect(p.kind).toBe('full');
    expect(p.tileRect.y + p.tileRect.h).toBeCloseTo(300);
  });

  it('trocar o tamanho da peça mantém a entrada inteira no mesmo lugar', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = solveLayout(rooms, tile({ lengthCm: 90, widthCm: 90, jointMm: 0 }), layout({ start: { x: 150, y: 290 } }));
    expect(pieceAt(res, { x: 150, y: 290 }).kind).toBe('full');
  });

  it('no modo por cômodo, cada cômodo usa a própria entrada', () => {
    const a = { ...rectRoom('a', 0, 0, 310, 300), start: { x: 40, y: 150 } };
    const b = rectRoom('b', 325, 0, 300, 300);
    const res = solveLayout([a, b], t60, layout({ gridMode: 'perRoom' }));
    const p = pieceAt(res, { x: 40, y: 150 });
    expect(p.roomId).toBe('a');
    expect(p.kind).toBe('full');
  });

  it('peça perto do canto: fica inteira, sem atravessar a parede, e sem deixar filete', () => {
    // perto da parede da esquerda e da de baixo; centralizar ou encostar na esquerda deixaria tiras de 10 cm
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const res = solveLayout(rooms, t60, layout({ start: { x: 40, y: 280 } }));
    const p = pieceAt(res, { x: 40, y: 280 });
    expect(p.kind).toBe('full');
    expect(p.tileRect.y + p.tileRect.h).toBeCloseTo(300);
    expect(res.summary.slivers).toBe(0);
  });

  it('entrancePoints lê a entrada do modo escolhido', () => {
    const rooms = [{ ...rectRoom('a', 0, 0, 300, 300), start: { x: 1, y: 2 } }];
    expect(entrancePoints(layout({ start: { x: 5, y: 5 } }), rooms)).toEqual([{ x: 5, y: 5 }]);
    expect(entrancePoints(layout(), rooms)).toEqual([]);
    expect(entrancePoints(layout({ gridMode: 'perRoom' }), rooms)).toEqual([{ x: 1, y: 2 }]);
  });

  it('entrancePiece acha a peça tocada, ou a mais perto quando o toque foi na soleira', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = solveLayout(rooms, t60, layout({ start: { x: 150, y: 290 } }));
    expect(entrancePiece(res, { x: 150, y: 290 })?.tileRect).toEqual({ x: 120, y: 240, w: 60, h: 60 });
    expect(entrancePiece(res, { x: 150, y: 306 })?.tileRect).toEqual({ x: 120, y: 240, w: 60, h: 60 });
    expect(entrancePiece(res, { x: 150, y: 900 })).toBeUndefined();
  });
});
