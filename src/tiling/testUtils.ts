import type { Ring } from '../geometry/types';
import { DEFAULT_LAYOUT, DEFAULT_TILE, type LayoutSpec, type RoomCm, type TileSpec } from './types';

export function rectRing(x: number, y: number, w: number, h: number): Ring {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function rectRoom(id: string, x: number, y: number, w: number, h: number): RoomCm {
  return { id, name: id, ring: rectRing(x, y, w, h) };
}

export function tile(patch: Partial<TileSpec> = {}): TileSpec {
  return { ...DEFAULT_TILE, ...patch };
}

export function layout(patch: Partial<LayoutSpec> = {}): LayoutSpec {
  return { ...DEFAULT_LAYOUT, ...patch };
}
