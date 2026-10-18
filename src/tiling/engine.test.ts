import { describe, expect, it } from 'vitest';
import { bbox, pointInPolygon, polygonArea } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';
import { computeLayout, solveLayout } from './engine';
import { layout, rectRoom, tile } from './testUtils';
import type { LayoutResult, RoomCm } from './types';

const origin0 = (rooms: RoomCm[], o: Point = { x: 0, y: 0 }) =>
  Object.fromEntries(rooms.map((r) => [r.id, o]));

function totalArea(res: LayoutResult): number {
  return res.pieces.reduce((s, p) => s + p.shape.reduce((a, r) => a + polygonArea(r), 0), 0);
}

function centroid(ring: Ring): Point {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    x += (p.x + q.x) * c;
    y += (p.y + q.y) * c;
  }
  return { x: x / (3 * a), y: y / (3 * a) };
}

describe('computeLayout', () => {
  it('300×300 com peça 60×60 sem rejunte: 25 inteiras', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = computeLayout(rooms, tile({ jointMm: 0 }), layout(), origin0(rooms));
    expect(res.pieces).toHaveLength(25);
    expect(res.summary.full).toBe(25);
    expect(res.summary.cut).toBe(0);
  });

  it('com rejunte de 2 mm a última coluna fica com 59,2 cm', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = computeLayout(rooms, tile({ jointMm: 2 }), layout(), origin0(rooms));
    expect(res.pieces).toHaveLength(25);
    const lastCol = res.pieces.filter((p) => Math.abs(p.tileRect.x - 4 * 60.2) < 1e-6 && p.tileRect.y < 200);
    expect(lastCol).toHaveLength(4);
    for (const p of lastCol) {
      expect(p.kind).toBe('cut');
      expect(p.cutType).toBe('straight');
      expect(p.cutSize!.w).toBeCloseTo(59.2, 6);
    }
  });

  it('cômodo em L: nenhuma peça fora e o canto interno é irregular', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 150 },
      { x: 400, y: 150 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    const rooms: RoomCm[] = [{ id: 'l', name: 'L', ring }];
    const res = computeLayout(rooms, tile({ jointMm: 0 }), layout(), origin0(rooms));
    for (const p of res.pieces) for (const r of p.shape) expect(pointInPolygon(centroid(r), ring)).toBe(true);
    expect(totalArea(res)).toBeCloseTo(polygonArea(ring), 3);
    expect(res.pieces.some((p) => p.cutType === 'shaped' || p.cutType === 'corner')).toBe(true);
  });

  it('parede inclinada: nenhuma peça fora e recortes irregulares', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 250, y: 300 },
      { x: 0, y: 300 },
    ];
    const rooms: RoomCm[] = [{ id: 't', name: 'T', ring }];
    const res = computeLayout(rooms, tile({ jointMm: 0 }), layout(), origin0(rooms));
    for (const p of res.pieces) {
      const area = p.shape.reduce((a, r) => a + polygonArea(r), 0);
      expect(area).toBeLessThanOrEqual(p.tileRect.w * p.tileRect.h + 1e-6);
      for (const r of p.shape) expect(pointInPolygon(centroid(r), ring)).toBe(true);
    }
    expect(totalArea(res)).toBeCloseTo(polygonArea(ring), 3);
    expect(res.pieces.some((p) => p.cutType === 'shaped')).toBe(true);
  });

  it('rotação 90° equivale ao cômodo transposto', () => {
    const t = tile({ lengthCm: 120, widthCm: 20, jointMm: 0 });
    const a = [rectRoom('a', 0, 0, 200, 300)];
    const b = [rectRoom('b', 0, 0, 300, 200)];
    const ra = computeLayout(a, t, layout({ rotationDeg: 90 }), origin0(a));
    const rb = computeLayout(b, t, layout({ rotationDeg: 0 }), origin0(b));
    expect(ra.pieces).toHaveLength(rb.pieces.length);
    expect(ra.summary.full).toBe(rb.summary.full);
    expect(ra.summary.cut).toBe(rb.summary.cut);
    const fullA = ra.pieces.find((p) => p.kind === 'full')!;
    expect(fullA.tileRect.w).toBe(20);
    expect(fullA.tileRect.h).toBe(120);
  });

  it('numeração é única e segue a ordem dos cômodos', () => {
    const rooms = [rectRoom('a', 0, 0, 120, 120), rectRoom('b', 130, 0, 120, 120)];
    const res = computeLayout(rooms, tile({ jointMm: 0 }), layout(), origin0(rooms));
    expect(res.pieces.map((p) => p.n)).toEqual(res.pieces.map((_, i) => i + 1));
    const lastA = Math.max(...res.pieces.filter((p) => p.roomId === 'a').map((p) => p.n));
    const firstB = Math.min(...res.pieces.filter((p) => p.roomId === 'b').map((p) => p.n));
    expect(lastA).toBeLessThan(firstB);
  });

  it('grade global fica contínua entre cômodos', () => {
    const rooms = [rectRoom('a', 0, 0, 300, 300), rectRoom('b', 310, 0, 290, 300)];
    const o = { x: 17, y: 5 };
    const res = computeLayout(rooms, tile({ jointMm: 2 }), layout(), origin0(rooms, o));
    for (const p of res.pieces) {
      const k = (p.tileRect.x - o.x) / 60.2;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    }
  });

  it('contagem: 25 peças novas, perda 10%, 4 por caixa → 28 peças e 7 caixas', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const res = computeLayout(rooms, tile({ jointMm: 0, wastePct: 10, piecesPerBox: 4 }), layout(), origin0(rooms));
    expect(res.summary.newTiles).toBe(25);
    expect(res.summary.tilesToBuy).toBe(28);
    expect(res.summary.boxes).toBe(7);
    expect(res.summary.areaM2).toBeCloseTo(9, 6);
  });

  it('caixas calculadas por m² quando só há m² por caixa', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const t = tile({ jointMm: 0, wastePct: 10, piecesPerBox: 0, m2PerBox: 1.44 });
    const res = computeLayout(rooms, t, layout(), origin0(rooms));
    expect(res.summary.boxes).toBe(7);
  });
});

describe('solveLayout', () => {
  it('310×300 com origem automática não deixa filete', () => {
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const res = solveLayout(rooms, tile({ jointMm: 2 }), layout());
    expect(res.summary.slivers).toBe(0);
    for (const p of res.pieces.filter((q) => q.kind !== 'full')) {
      if (p.cutSize!.w < 60 - 0.05) expect(p.cutSize!.w).toBeGreaterThanOrEqual(20);
      if (p.cutSize!.h < 60 - 0.05) expect(p.cutSize!.h).toBeGreaterThanOrEqual(20);
    }
  });

  it('peça maior que o cômodo: só recortes, sem erro', () => {
    const rooms = [rectRoom('lavabo', 0, 0, 90, 150)];
    const res = solveLayout(rooms, tile({ lengthCm: 120, widthCm: 20, jointMm: 0 }), layout());
    expect(res.pieces.length).toBeGreaterThan(0);
    expect(res.pieces.every((p) => p.kind !== 'full')).toBe(true);
  });

  it('soma das áreas das peças = área do cômodo menos o rejunte', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    expect(totalArea(solveLayout(rooms, tile({ jointMm: 0 }), layout()))).toBeCloseTo(90000, 3);
    const withJoint = totalArea(solveLayout(rooms, tile({ jointMm: 2 }), layout()));
    expect(withJoint).toBeLessThan(90000);
    expect(withJoint).toBeGreaterThan(90000 * 0.99);
  });

  it('modo por cômodo usa a origem do cômodo quando definida', () => {
    const rooms: RoomCm[] = [{ ...rectRoom('a', 0, 0, 300, 300), origin: { x: 10, y: 10 } }];
    const res = solveLayout(rooms, tile({ jointMm: 0 }), layout({ gridMode: 'perRoom' }));
    expect(res.roomOrigins.a).toEqual({ x: 10, y: 10 });
    expect(bbox(res.pieces[0].shape).x).toBe(0);
  });

  it('régua 20×120 em amarração reaproveita sobras', () => {
    const rooms = [rectRoom('quarto', 0, 0, 250, 200)];
    const res = solveLayout(
      rooms,
      tile({ lengthCm: 120, widthCm: 20, jointMm: 0 }),
      layout({ pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 3 } }),
    );
    expect(res.summary.fromLeftovers).toBeGreaterThan(0);
    const used = res.pieces.map((p) => p.fromLeftoverOf).filter((n) => n !== undefined);
    expect(new Set(used).size).toBe(used.length);
  });
});
