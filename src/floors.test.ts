import { describe, expect, it } from 'vitest';
import { FIRST_FLOOR_ID, floorById, floorName, newFloor, roomFloorId } from './floors';
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
