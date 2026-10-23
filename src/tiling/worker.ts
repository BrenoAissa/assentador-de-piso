/// <reference lib="webworker" />
import { comparePatterns } from './compare';
import { solveFloors } from './floors';
import type { FloorInput, LayoutSpec, ManualEdits, RoomCm, TileSpec } from './types';

export type TilingRequest =
  | { id: number; type: 'solve'; floors: FloorInput[]; edits?: ManualEdits }
  | { id: number; type: 'compare'; rooms: RoomCm[]; tile: TileSpec; layout: LayoutSpec };

self.onmessage = (e: MessageEvent<TilingRequest>) => {
  const req = e.data;
  const { id } = req;
  try {
    const result = req.type === 'solve' ? solveFloors(req.floors, req.edits) : comparePatterns(req.rooms, req.tile, req.layout);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
