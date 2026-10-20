import { bbox, isSimple, polygonArea, swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { classify } from './classify';
import { clipRectToRing } from './clip';
import { summarize } from './count';
import { pitch, tileRects } from './grid';
import { applyRowOrder, pieceKey, rowKey } from './edits';
import { assignLeftovers } from './leftovers';
import { optimizeOrigin } from './optimize';
import { NO_EDITS, type LayoutResult, type LayoutSpec, type ManualEdits, type Piece, type RoomCm, type TileSpec } from './types';
import { startOrigin } from './start';

const MIN_AREA = 0.5;

const swapPoint = (p: Point): Point => ({ x: p.y, y: p.x });

/**
 * Calcula a paginação com as origens dadas (referencial da planta, uma por cômodo) e os
 * ajustes manuais (fileiras deslizadas, fileiras reordenadas, peças apagadas ou escondidas).
 */
export function computeLayout(
  rooms: RoomCm[],
  tile: TileSpec,
  layout: LayoutSpec,
  origins: Record<string, Point>,
  edits: ManualEdits = NO_EDITS,
): LayoutResult {
  const swap = layout.rotationDeg === 90;
  const { L, W, joint } = pitch(tile);
  const removed = new Set(edits.removed);
  const hidden = new Set(edits.hidden);
  const pieces: Piece[] = [];
  const warnings: string[] = [];
  let floorArea = 0;

  for (const room of rooms) {
    if (!isSimple(room.ring)) {
      warnings.push(`O contorno de "${room.name}" é inválido e ficou fora do cálculo.`);
      continue;
    }
    floorArea += polygonArea(room.ring);
    const ring = swap ? swapXY(room.ring) : room.ring;
    const o = origins[room.id] ?? { x: 0, y: 0 };
    const origin = swap ? swapPoint(o) : o;
    const extra = (r: number) => edits.rowShift[rowKey(room.id, r)] ?? 0;
    const roomPieces: Piece[] = [];
    for (const { r, c, rect } of tileRects(bbox(ring), origin, tile, layout, extra)) {
      const shape = clipRectToRing(rect, ring).filter((s) => polygonArea(s) >= MIN_AREA);
      if (shape.length === 0) continue;
      const key = pieceKey(room.id, r, c);
      roomPieces.push({
        n: 0,
        key,
        roomId: room.id,
        row: r,
        col: c,
        tileRect: rect,
        shape,
        ...classify(shape, rect, L, W, layout),
        ...(removed.has(key) ? { removed: true } : {}),
        ...(hidden.has(key) ? { hidden: true } : {}),
      });
    }
    // fileiras reordenadas à mão; a numeração segue a ordem física
    const rows = new Map<number, Piece[]>();
    for (const p of roomPieces) rows.set(p.row, [...(rows.get(p.row) ?? []), p]);
    for (const [r, rowPieces] of rows) {
      const order = edits.rowOrder[rowKey(room.id, r)];
      if (order) applyRowOrder(rowPieces, order, joint);
    }
    roomPieces.sort((a, b) => a.row - b.row || bbox(a.shape).x - bbox(b.shape).x);
    pieces.push(...roomPieces);
  }

  pieces.forEach((p, i) => (p.n = i + 1));
  assignLeftovers(
    pieces.filter((p) => !p.removed),
    L,
    W,
    layout,
  );

  if (swap) {
    for (const p of pieces) {
      const t = p.tileRect;
      p.tileRect = { x: t.y, y: t.x, w: t.h, h: t.w };
      p.shape = p.shape.map(swapXY);
      if (p.cutSize) p.cutSize = { w: p.cutSize.h, h: p.cutSize.w };
    }
  }

  const first = rooms[0] ? origins[rooms[0].id] : undefined;
  return {
    pieces,
    summary: summarize(pieces, tile, floorArea),
    originUsed: first ?? { x: 0, y: 0 },
    roomOrigins: { ...origins },
    warnings,
  };
}

/**
 * Resolve a origem (a peça da entrada, se marcada; senão a salva ou a automática), global ou por
 * cômodo, e calcula a paginação.
 */
export function solveLayout(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec, edits: ManualEdits = NO_EDITS): LayoutResult {
  const valid = rooms.filter((r) => isSimple(r.ring));
  const origins: Record<string, Point> = {};
  if (layout.gridMode === 'global') {
    const o = layout.start
      ? startOrigin(valid, tile, layout, layout.start)
      : layout.origin === 'auto'
        ? optimizeOrigin(valid, tile, layout)
        : layout.origin;
    for (const r of rooms) origins[r.id] = o;
  } else {
    for (const r of rooms) {
      const ok = isSimple(r.ring);
      origins[r.id] = r.start && ok ? startOrigin([r], tile, layout, r.start) : (r.origin ?? (ok ? optimizeOrigin([r], tile, layout) : { x: 0, y: 0 }));
    }
  }
  return computeLayout(rooms, tile, layout, origins, edits);
}
