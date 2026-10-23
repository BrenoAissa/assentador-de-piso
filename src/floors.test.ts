import { describe, expect, it } from 'vitest';
import {
  FIRST_FLOOR_ID,
  floorById,
  floorName,
  floorRoomIds,
  newFloor,
  roomFloorId,
  withFloorLayout,
  withFloorTile,
  withNewFloor,
  withoutFloor,
  withRoomFloor,
  withSplitRoom,
} from './floors';
import type { Ring } from './geometry/types';
import { rectRing } from './tiling/testUtils';
import { DEFAULT_LAYOUT, DEFAULT_TILE, NO_EDITS, type TileSpec } from './tiling/types';
import { emptyProject, normalizeProject, type Project, type Room } from './types';

const tile = (l: number, w: number): TileSpec => ({ ...DEFAULT_TILE, lengthCm: l, widthCm: w });
const room = (id: string, patch: Partial<Room> = {}): Room => ({
  id,
  name: id,
  polygonPx: rectRing(0, 0, 300, 300),
  receivesTile: true,
  issues: [],
  ...patch,
});

describe('nome do piso', () => {
  it('vem das medidas da peça, em cm', () => {
    expect(floorName(tile(83, 83))).toBe('Piso 83 × 83 cm');
    expect(floorName(tile(120, 20))).toBe('Piso 120 × 20 cm');
  });

  it('usa vírgula nas medidas quebradas', () => {
    expect(floorName(tile(82.5, 82.5))).toBe('Piso 82,5 × 82,5 cm');
  });
});

describe('projetos com pisos', () => {
  it('projeto antigo (uma peça e um layout) vira um projeto de um piso igual', () => {
    const t83 = tile(83, 83);
    const layout = { ...DEFAULT_LAYOUT, pattern: 'running' as const };
    const edits = { ...NO_EDITS, removed: ['a:0:0'] };
    const antigo = { version: 1, plan: null, scale: null, rooms: [room('a')], tile: t83, layout, edits } as unknown as Project;
    const p = normalizeProject(antigo);
    expect(p.floors).toHaveLength(1);
    expect(p.floors[0].id).toBe(FIRST_FLOOR_ID);
    expect(p.floors[0].tile).toEqual(t83);
    expect(p.floors[0].layout).toEqual(layout);
    expect(p.floors[0].name).toBe('Piso 83 × 83 cm');
    expect('tile' in p).toBe(false);
    expect('layout' in p).toBe(false);
    expect(p.edits).toEqual(edits);
  });

  it('projeto que já tem pisos continua com os mesmos pisos', () => {
    const p = { ...emptyProject(), floors: [newFloor('piso-1'), newFloor('piso-2', tile(85, 85))] };
    expect(normalizeProject(p).floors).toEqual(p.floors);
  });

  it('projeto vazio começa com um piso de 60 × 60', () => {
    const p = emptyProject();
    expect(p.floors).toHaveLength(1);
    expect(p.floors[0].tile).toEqual(DEFAULT_TILE);
  });
});

describe('piso de cada cômodo', () => {
  const p: Project = { ...emptyProject(), floors: [newFloor('piso-1'), newFloor('piso-2', tile(85, 85))] };

  it('sem piso escolhido, o cômodo fica no primeiro piso', () => {
    expect(roomFloorId(p, room('a'))).toBe('piso-1');
  });

  it('piso que não existe mais cai no primeiro piso', () => {
    expect(roomFloorId(p, room('a', { floorId: 'apagado' }))).toBe('piso-1');
  });

  it('piso escolhido e existente é respeitado', () => {
    expect(roomFloorId(p, room('a', { floorId: 'piso-2' }))).toBe('piso-2');
  });

  it('cômodo que não recebe piso não tem piso', () => {
    expect(roomFloorId(p, room('a', { receivesTile: false, floorId: 'piso-2' }))).toBeNull();
  });

  it('floorById acha o piso, ou devolve o primeiro', () => {
    expect(floorById(p, 'piso-2').tile.lengthCm).toBe(85);
    expect(floorById(p, 'nao-existe').id).toBe('piso-1');
  });
});

describe('mudanças por piso', () => {
  // cômodo a no piso 1, cômodo b no piso 2, com ajustes manuais nos dois
  const base = (): Project => ({
    ...emptyProject(),
    rooms: [room('a'), room('b', { floorId: 'piso-2' })],
    floors: [newFloor('piso-1', { ...DEFAULT_TILE, jointMm: 3, piecesPerBox: 5 }), newFloor('piso-2', tile(85, 85))],
    edits: { rowShift: { 'a:0': 4, 'b:1': 7 }, rowOrder: {}, removed: ['a:0:0', 'b:1:2'], hidden: [] },
  });

  it('floorRoomIds lista os cômodos de cada piso', () => {
    expect([...floorRoomIds(base(), 'piso-1')]).toEqual(['a']);
    expect([...floorRoomIds(base(), 'piso-2')]).toEqual(['b']);
  });

  it('mudar a peça de um piso desfaz só os ajustes dos cômodos dele', () => {
    const p = withFloorTile(base(), 'piso-2', { lengthCm: 90 });
    expect(p.floors[1].tile.lengthCm).toBe(90);
    expect(p.edits.rowShift).toEqual({ 'a:0': 4 });
    expect(p.edits.removed).toEqual(['a:0:0']);
  });

  it('mudar a compra (peças por caixa, m² por caixa, folga) não desfaz os ajustes do piso', () => {
    expect(withFloorTile(base(), 'piso-2', { piecesPerBox: 6 }).edits).toEqual(base().edits);
    expect(withFloorTile(base(), 'piso-2', { m2PerBox: 1.44, wastePct: 15 }).edits).toEqual(base().edits);
    expect(withFloorTile(base(), 'piso-2', { jointMm: 3 }).edits.rowShift).toEqual({ 'a:0': 4 });
  });

  it('o nome automático acompanha a peça; o nome dado pela pessoa fica', () => {
    expect(withFloorTile(base(), 'piso-2', { lengthCm: 90, widthCm: 90 }).floors[1].name).toBe('Piso 90 × 90 cm');
    const renomeado = base();
    renomeado.floors[1].name = 'Porcelanato da cozinha';
    expect(withFloorTile(renomeado, 'piso-2', { lengthCm: 90 }).floors[1].name).toBe('Porcelanato da cozinha');
  });

  it('mudar o encaixe de um piso desfaz só os ajustes dele; mudar a compra não desfaz', () => {
    const grade = withFloorLayout(base(), 'piso-1', { pattern: 'running' });
    expect(grade.floors[0].layout.pattern).toBe('running');
    expect(grade.edits.rowShift).toEqual({ 'b:1': 7 });
    const filete = withFloorLayout(base(), 'piso-1', { minCutCm: 3 });
    expect(filete.edits).toEqual(base().edits);
  });

  it('piso novo copia rejunte e compra do piso atual, com peça de 60 × 60 e sem cômodos', () => {
    const p = withNewFloor(base(), 'piso-1', 'novo');
    const f = p.floors.find((x) => x.id === 'novo')!;
    expect(f.tile).toEqual({ ...DEFAULT_TILE, jointMm: 3, piecesPerBox: 5 });
    expect(f.layout).toEqual(DEFAULT_LAYOUT);
    expect(floorRoomIds(p, 'novo').size).toBe(0);
  });

  it('o primeiro piso não pode ser apagado; apagar outro devolve os cômodos ao primeiro', () => {
    expect(withoutFloor(base(), 'piso-1').floors).toHaveLength(2);
    const p = withoutFloor(base(), 'piso-2');
    expect(p.floors).toHaveLength(1);
    expect(p.rooms.find((r) => r.id === 'b')!.floorId).toBeUndefined();
    expect(roomFloorId(p, p.rooms.find((r) => r.id === 'b')!)).toBe('piso-1');
  });

  it('cômodo sem piso deixa de receber piso; trocar de piso desfaz os ajustes dele', () => {
    const sem = withRoomFloor(base(), 'b', null);
    expect(sem.rooms.find((r) => r.id === 'b')!.receivesTile).toBe(false);
    const troca = withRoomFloor(base(), 'b', 'piso-1');
    const b = troca.rooms.find((r) => r.id === 'b')!;
    expect(b.receivesTile).toBe(true);
    expect(b.floorId).toBe('piso-1');
    expect(troca.edits.rowShift).toEqual({ 'a:0': 4 });
    expect(troca.edits.removed).toEqual(['a:0:0']);
  });
});

describe('dividir cômodo', () => {
  it('vira dois cômodos com o nome numerado, no mesmo piso, sem ajustes, começo nem entrada', () => {
    const p: Project = {
      ...emptyProject(),
      rooms: [room('sala', { name: 'Sala', floorId: 'piso-2', start: { x: 10, y: 10 }, origin: { x: 1, y: 1 } }), room('quarto')],
      floors: [newFloor('piso-1'), newFloor('piso-2', tile(85, 85))],
      edits: { ...NO_EDITS, removed: ['sala:0:0', 'quarto:1:1'] },
    };
    const parts: [Ring, Ring] = [rectRing(0, 0, 200, 300), rectRing(200, 0, 100, 300)];
    const next = withSplitRoom(p, 'sala', parts, 'novo');
    const a = next.rooms.find((r) => r.id === 'sala')!;
    const b = next.rooms.find((r) => r.id === 'novo')!;
    expect(a.name).toBe('Sala 1');
    expect(b.name).toBe('Sala 2');
    expect(a.polygonPx).toEqual(parts[0]);
    expect(b.polygonPx).toEqual(parts[1]);
    expect(roomFloorId(next, b)).toBe('piso-2');
    expect(a.start).toBeUndefined();
    expect(a.origin).toBeUndefined();
    expect(next.edits.removed).toEqual(['quarto:1:1']);
  });

  it('cômodo sem nome usa "Cômodo N" como base', () => {
    const p: Project = { ...emptyProject(), rooms: [room('x', { name: '' })] };
    const next = withSplitRoom(p, 'x', [rectRing(0, 0, 1, 1), rectRing(1, 0, 1, 1)], 'y');
    expect(next.rooms.map((r) => r.name)).toEqual(['Cômodo 1 1', 'Cômodo 1 2']);
  });
});

