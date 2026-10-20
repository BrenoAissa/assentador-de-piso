import { describe, expect, it } from 'vitest';
import { bbox } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import { moveInOrder, slotStart, targetIndex } from './edits';
import { computeLayout } from './engine';
import { layout, rectRoom, tile } from './testUtils';
import { NO_EDITS, type ManualEdits, type RoomCm } from './types';

const o0 = (rooms: RoomCm[]) => Object.fromEntries(rooms.map((r) => [r.id, { x: 0, y: 0 }]));
const edits = (patch: Partial<ManualEdits>): ManualEdits => ({ ...NO_EDITS, ...patch });
const t60 = tile({ jointMm: 0 });

describe('ajustes manuais no motor', () => {
  it('cada peça tem uma chave estável cômodo:fileira:coluna', () => {
    const rooms = [rectRoom('sala', 0, 0, 120, 60)];
    const res = computeLayout(rooms, t60, layout(), o0(rooms));
    expect(res.pieces.map((p) => p.key)).toEqual(['sala:0:0', 'sala:0:1']);
  });

  it('deslizar uma fileira muda só ela', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 120)];
    const res = computeLayout(rooms, t60, layout(), o0(rooms), edits({ rowShift: { 'sala:0': 30 } }));
    const row0 = res.pieces.filter((p) => p.row === 0).map((p) => bbox(p.shape));
    const row1 = res.pieces.filter((p) => p.row === 1);
    expect(row0[0].w).toBeCloseTo(30);
    expect(row0[row0.length - 1].w).toBeCloseTo(30);
    expect(row1.every((p) => p.kind === 'full')).toBe(true);
  });

  it('reordenar a fileira leva o recorte para o outro lado e acomoda as outras peças', () => {
    const rooms = [rectRoom('sala', 0, 0, 330, 60)];
    // colunas 0..4 inteiras (0..300), coluna 5 recortada (300..330)
    const res = computeLayout(rooms, t60, layout(), o0(rooms), edits({ rowOrder: { 'sala:0': [5, 0, 1, 2, 3, 4] } }));
    const byCol = new Map(res.pieces.map((p) => [p.col, bbox(p.shape)]));
    expect(byCol.get(5)).toMatchObject({ x: 0, w: 30 });
    expect(byCol.get(0)).toMatchObject({ x: 30, w: 60 });
    expect(byCol.get(4)).toMatchObject({ x: 270, w: 60 });
    // numeração segue a ordem física
    expect(res.pieces.map((p) => p.col)).toEqual([5, 0, 1, 2, 3, 4]);
  });

  it('com rejunte, reordenar mantém o rejunte entre as peças e não passa da parede', () => {
    const rooms = [rectRoom('sala', 0, 0, 330, 60)];
    const res = computeLayout(rooms, tile({ jointMm: 2 }), layout(), o0(rooms), edits({ rowOrder: { 'sala:0': [5, 0, 1, 2, 3, 4] } }));
    const boxes = res.pieces.filter((p) => p.row === 0).map((p) => bbox(p.shape));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x - (boxes[i - 1].x + boxes[i - 1].w)).toBeCloseTo(0.2);
    const last = boxes[boxes.length - 1];
    expect(last.x + last.w).toBeLessThanOrEqual(330 + 1e-6);
  });

  it('fileira que não é uma faixa reta (cômodo em L) ignora a reordenação sem quebrar', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 30 },
      { x: 240, y: 30 },
      { x: 240, y: 60 },
      { x: 0, y: 60 },
    ];
    const rooms: RoomCm[] = [{ id: 'l', name: 'L', ring }];
    const plain = computeLayout(rooms, t60, layout(), o0(rooms));
    const res = computeLayout(rooms, t60, layout(), o0(rooms), edits({ rowOrder: { 'l:0': [3, 2, 1, 0] } }));
    expect(res.pieces.map((p) => bbox(p.shape))).toEqual(plain.pieces.map((p) => bbox(p.shape)));
  });

  it('peça apagada sai da compra e das contagens', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 300)];
    const plain = computeLayout(rooms, t60, layout(), o0(rooms));
    const res = computeLayout(rooms, t60, layout(), o0(rooms), edits({ removed: ['sala:2:2'] }));
    expect(res.summary.newTiles).toBe(plain.summary.newTiles - 1);
    expect(res.summary.full).toBe(plain.summary.full - 1);
    expect(res.summary.removed).toBe(1);
    expect(res.pieces.find((p) => p.key === 'sala:2:2')!.removed).toBe(true);
  });

  it('filete marcado como embaixo de móvel não conta como à vista', () => {
    const rooms = [rectRoom('sala', 0, 0, 310, 60)];
    const plain = computeLayout(rooms, t60, layout(), o0(rooms));
    const sliver = plain.pieces.find((p) => p.kind === 'sliver')!;
    const res = computeLayout(rooms, t60, layout(), o0(rooms), edits({ hidden: [sliver.key] }));
    expect(plain.summary.slivers).toBe(1);
    expect(res.summary.slivers).toBe(0);
    expect(res.summary.hidden).toBe(1);
    expect(res.pieces.find((p) => p.key === sliver.key)!.hidden).toBe(true);
  });
});

describe('ajudantes de reordenação', () => {
  it('moveInOrder tira a coluna do lugar e põe no índice pedido', () => {
    expect(moveInOrder([0, 1, 2, 3], 3, 0)).toEqual([3, 0, 1, 2]);
    expect(moveInOrder([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
  });

  it('targetIndex acha a posição pelo centro das peças', () => {
    // centros em 30, 90, 150, 210
    const centers = [30, 90, 150, 210];
    expect(targetIndex(centers, 10)).toBe(0);
    expect(targetIndex(centers, 100)).toBe(2);
    expect(targetIndex(centers, 400)).toBe(4);
  });

  it('slotStart diz onde a peça arrastada vai cair (a vaga, não o mouse)', () => {
    // fileira: recorte de 25, três inteiras de 60, rejunte 0,2
    const spans = [
      { start: 0, len: 25 },
      { start: 25.2, len: 60 },
      { start: 85.4, len: 60 },
      { start: 145.6, len: 60 },
    ];
    // o recorte (índice 0) indo para o fim: depois das três inteiras
    expect(slotStart(spans, 0, 3, 0.2)).toBeCloseTo(180.6);
    // uma inteira indo para o começo: no início da fileira
    expect(slotStart(spans, 2, 0, 0.2)).toBeCloseTo(0);
    // ficando no lugar
    expect(slotStart(spans, 1, 1, 0.2)).toBeCloseTo(25.2);
  });
});
