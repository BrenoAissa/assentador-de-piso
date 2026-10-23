import type { LayoutSpec, ManualEdits } from '../tiling/types';

/** Passos guardados para "Desfazer" (só na sessão). */
export const HISTORY_LIMIT = 50;

export function hasEdits(e: ManualEdits): boolean {
  return (
    Object.keys(e.rowShift).length > 0 || Object.keys(e.rowOrder).length > 0 || e.removed.length > 0 || e.hidden.length > 0
  );
}

/** Campos do layout que mudam a grade (e, portanto, as chaves das peças). */
const GRID_FIELDS: (keyof LayoutSpec)[] = ['pattern', 'runningOffset', 'rotationDeg', 'gridMode', 'origin', 'start'];

export function layoutChangeResetsEdits(patch: Partial<LayoutSpec>): boolean {
  return GRID_FIELDS.some((k) => k in patch);
}

/** Tira os ajustes manuais dos cômodos dados (chaves `cômodo:fileira[:coluna]`). */
export function dropRoomEdits(edits: ManualEdits, roomIds: Set<string>): ManualEdits {
  const keep = (key: string) => !roomIds.has(key.slice(0, key.indexOf(':')));
  const pick = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([k]) => keep(k)));
  return { rowShift: pick(edits.rowShift), rowOrder: pick(edits.rowOrder), removed: edits.removed.filter(keep), hidden: edits.hidden.filter(keep) };
}

export function pushHistory<T>(history: T[], entry: T): T[] {
  const next = [...history, entry];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export function toggleKey(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}
