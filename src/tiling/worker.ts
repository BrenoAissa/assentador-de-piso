/// <reference lib="webworker" />
import { comparePatterns } from './compare';
import { solveLayout } from './engine';
import type { LayoutSpec, ManualEdits, RoomCm, TileSpec } from './types';

export interface TilingRequest {
  id: number;
  type: 'solve' | 'compare';
  rooms: RoomCm[];
  tile: TileSpec;
  layout: LayoutSpec;
  edits?: ManualEdits;
}

self.onmessage = (e: MessageEvent<TilingRequest>) => {
  const { id, type, rooms, tile, layout, edits } = e.data;
  try {
    const result = type === 'solve' ? solveLayout(rooms, tile, layout, edits) : comparePatterns(rooms, tile, layout);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
