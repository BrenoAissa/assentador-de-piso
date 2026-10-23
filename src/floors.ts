import { DEFAULT_LAYOUT, DEFAULT_TILE, type LayoutSpec, type TileSpec } from './tiling/types';
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
