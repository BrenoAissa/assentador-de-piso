import { solveLayout } from './engine';
import type { LayoutResult, LayoutSpec, RoomCm, TileSpec } from './types';

export interface PatternOption {
  label: string;
  layout: LayoutSpec;
  result: LayoutResult;
}

const PRESETS: { label: string; patch: Partial<LayoutSpec> }[] = [
  { label: 'Alinhado', patch: { pattern: 'straight' } },
  { label: 'Tijolinho', patch: { pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 2 } } },
  { label: 'Escada', patch: { pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 3 } } },
];

/** Roda o motor com origem automática para cada paginação de referência. */
export function comparePatterns(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec): PatternOption[] {
  return PRESETS.map(({ label, patch }) => {
    const l: LayoutSpec = { ...layout, ...patch, origin: 'auto' };
    return { label, layout: l, result: solveLayout(rooms, tile, l) };
  });
}
