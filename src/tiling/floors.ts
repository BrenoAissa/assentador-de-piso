import { solveLayout } from './engine';
import { NO_EDITS, type FloorInput, type LayoutResult, type ManualEdits, type ProjectLayout } from './types';

/**
 * Junta os resultados dos pisos numa planta só: numeração contínua (a sobra usada é renumerada
 * junto) e cada peça marcada com o seu piso.
 */
export function mergeFloors(parts: { floorId: string; result: LayoutResult }[]): ProjectLayout {
  let offset = 0;
  const pieces = parts.flatMap(({ floorId, result }) => {
    const base = offset;
    offset += result.pieces.length;
    return result.pieces.map((p) => ({
      ...p,
      n: p.n + base,
      floorId,
      ...(p.fromLeftoverOf !== undefined ? { fromLeftoverOf: p.fromLeftoverOf + base } : {}),
    }));
  });
  return { pieces, floors: parts, warnings: parts.flatMap((p) => p.result.warnings) };
}

/** Pagina cada piso com os seus cômodos (sobras só dentro do piso) e junta tudo. */
export function solveFloors(floors: FloorInput[], edits: ManualEdits = NO_EDITS): ProjectLayout {
  return mergeFloors(floors.map((f) => ({ floorId: f.id, result: solveLayout(f.rooms, f.tile, f.layout, edits) })));
}

/** Troca o resultado de um piso (a prévia do arraste) mantendo os outros. */
export function replaceFloor(layout: ProjectLayout, floorId: string, result: LayoutResult): ProjectLayout {
  return mergeFloors(layout.floors.map((f) => (f.floorId === floorId ? { floorId, result } : f)));
}

export function floorResult(layout: ProjectLayout, floorId: string): LayoutResult | undefined {
  return layout.floors.find((f) => f.floorId === floorId)?.result;
}
