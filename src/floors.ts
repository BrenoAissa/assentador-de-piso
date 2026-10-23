import { dropRoomEdits, layoutChangeResetsEdits } from './store/edits';
import { DEFAULT_LAYOUT, DEFAULT_TILE, type LayoutSpec, type TileSpec } from './tiling/types';
import type { Ring } from './geometry/types';
import type { Floor, Project, Room } from './types';
import { fmt } from './ui/format';

/** Id do piso que todo projeto tem (o dos projetos de antes dos pisos). */
export const FIRST_FLOOR_ID = 'piso-1';

/** Nome padrão do piso, pelas medidas da peça: "Piso 83 × 83 cm". */
export function floorName(tile: TileSpec): string {
  return `Piso ${fmt(tile.lengthCm)} × ${fmt(tile.widthCm)} cm`;
}

export function newFloor(id: string, tile: TileSpec = DEFAULT_TILE, layout: LayoutSpec = DEFAULT_LAYOUT): Floor {
  return { id, name: floorName(tile), tile: { ...tile }, layout: { ...layout } };
}

/** Piso pelo id; um id que não existe (piso apagado) cai no primeiro piso. */
export function floorById(project: Project, id: string): Floor {
  return project.floors.find((f) => f.id === id) ?? project.floors[0];
}

/** Piso que o cômodo recebe, ou null se ele não recebe piso. */
export function roomFloorId(project: Project, room: Room): string | null {
  if (!room.receivesTile) return null;
  return room.floorId && project.floors.some((f) => f.id === room.floorId) ? room.floorId : project.floors[0].id;
}

/** Cômodos que recebem o piso dado. */
export function floorRoomIds(project: Project, floorId: string): Set<string> {
  return new Set(project.rooms.filter((r) => roomFloorId(project, r) === floorId).map((r) => r.id));
}

const mapFloor = (p: Project, id: string, fn: (f: Floor) => Floor): Floor[] => p.floors.map((f) => (f.id === id ? fn(f) : f));

/** Campos da peça que mudam a grade; compra (caixa, folga) não mexe nas peças. */
const GRID_TILE_FIELDS: (keyof TileSpec)[] = ['lengthCm', 'widthCm', 'jointMm'];

/** Muda a peça de um piso; se a grade mudar, os ajustes manuais dos cômodos dele saem. */
export function withFloorTile(p: Project, floorId: string, patch: Partial<TileSpec>): Project {
  return {
    ...p,
    floors: mapFloor(p, floorId, (f) => {
      const tile = { ...f.tile, ...patch };
      // nome automático acompanha a peça; nome dado pela pessoa fica
      return { ...f, tile, name: f.name === floorName(f.tile) ? floorName(tile) : f.name };
    }),
    edits: GRID_TILE_FIELDS.some((k) => k in patch) ? dropRoomEdits(p.edits, floorRoomIds(p, floorId)) : p.edits,
  };
}

/** Muda o layout de um piso; se mexer na grade, os ajustes manuais dos cômodos dele saem. */
export function withFloorLayout(p: Project, floorId: string, patch: Partial<LayoutSpec>): Project {
  return {
    ...p,
    floors: mapFloor(p, floorId, (f) => ({ ...f, layout: { ...f.layout, ...patch } })),
    edits: layoutChangeResetsEdits(patch) ? dropRoomEdits(p.edits, floorRoomIds(p, floorId)) : p.edits,
  };
}

/** Piso novo, sem cômodos, com rejunte e compra do piso `copyFrom` e peça de 60 × 60. */
export function withNewFloor(p: Project, copyFrom: string, id: string): Project {
  const { jointMm, piecesPerBox, m2PerBox, wastePct } = floorById(p, copyFrom).tile;
  const tile: TileSpec = { ...DEFAULT_TILE, jointMm, piecesPerBox, wastePct, ...(m2PerBox !== undefined ? { m2PerBox } : {}) };
  return { ...p, floors: [...p.floors, newFloor(id, tile)] };
}

/** Apaga um piso (menos o primeiro); os cômodos dele voltam ao primeiro piso, sem os ajustes. */
export function withoutFloor(p: Project, id: string): Project {
  if (id === p.floors[0].id || !p.floors.some((f) => f.id === id)) return p;
  const moved = floorRoomIds(p, id);
  return {
    ...p,
    floors: p.floors.filter((f) => f.id !== id),
    rooms: p.rooms.map((r) => {
      if (r.floorId !== id) return r;
      const { floorId, ...rest } = r;
      void floorId;
      return rest;
    }),
    edits: dropRoomEdits(p.edits, moved),
  };
}

/** Escolhe o piso de um cômodo (null = sem piso); o cômodo muda de grade e perde os ajustes. */
export function withRoomFloor(p: Project, roomId: string, floorId: string | null): Project {
  return {
    ...p,
    rooms: p.rooms.map((r) => (r.id !== roomId ? r : floorId === null ? { ...r, receivesTile: false } : { ...r, receivesTile: true, floorId })),
    edits: dropRoomEdits(p.edits, new Set([roomId])),
  };
}

/**
 * Divide um cômodo em dois na divisa: o original fica com `parts[0]` e "{nome} 1", o novo com
 * `parts[1]` e "{nome} 2", no mesmo piso. Os dois perdem ajustes manuais, começo e entrada.
 */
export function withSplitRoom(p: Project, roomId: string, parts: [Ring, Ring], newId: string): Project {
  const i = p.rooms.findIndex((r) => r.id === roomId);
  if (i < 0) return p;
  const { origin, start, ...room } = p.rooms[i];
  void origin;
  void start;
  const base = room.name.trim() || `Cômodo ${i + 1}`;
  const first: Room = { ...room, name: `${base} 1`, polygonPx: parts[0] };
  const second: Room = { ...room, id: newId, name: `${base} 2`, polygonPx: parts[1] };
  const rooms = [...p.rooms];
  rooms.splice(i, 1, first, second);
  return { ...p, rooms, edits: dropRoomEdits(p.edits, new Set([roomId])) };
}

