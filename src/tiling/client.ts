import type { PatternOption } from './compare';
import type { LayoutResult, LayoutSpec, ManualEdits, RoomCm, TileSpec } from './types';
import type { TilingRequest } from './worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error ?? 'Falha no cálculo.'));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Falha no cálculo.'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function call<T>(type: TilingRequest['type'], rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec, edits?: ManualEdits): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ id, type, rooms, tile, layout, edits } satisfies TilingRequest);
  });
}

export const solveInWorker = (rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec, edits?: ManualEdits) =>
  call<LayoutResult>('solve', rooms, tile, layout, edits);

export const compareInWorker = (rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec) =>
  call<PatternOption[]>('compare', rooms, tile, layout);
