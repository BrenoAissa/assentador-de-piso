import { bbox, isSimple, polygonArea, swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { classify } from './classify';
import { clipRectToRing } from './clip';
import { summarize } from './count';
import { pitch, tileRects } from './grid';
import { assignLeftovers } from './leftovers';
import { optimizeOrigin } from './optimize';
import type { LayoutResult, LayoutSpec, Piece, RoomCm, TileSpec } from './types';

const MIN_AREA = 0.5;

const swapPoint = (p: Point): Point => ({ x: p.y, y: p.x });

/** Calcula a paginação com as origens dadas (referencial da planta, uma por cômodo). */
export function computeLayout(
  rooms: RoomCm[],
  tile: TileSpec,
  layout: LayoutSpec,
  origins: Record<string, Point>,
): LayoutResult {
  const swap = layout.rotationDeg === 90;
  const { L, W } = pitch(tile);
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
    for (const { r, c, rect } of tileRects(bbox(ring), origin, tile, layout)) {
      const shape = clipRectToRing(rect, ring).filter((s) => polygonArea(s) >= MIN_AREA);
      if (shape.length === 0) continue;
      pieces.push({ n: 0, roomId: room.id, row: r, col: c, tileRect: rect, shape, ...classify(shape, rect, L, W, layout) });
    }
  }

  pieces.forEach((p, i) => (p.n = i + 1));
  assignLeftovers(pieces, L, W, layout);

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

/** Resolve a origem automática (global ou por cômodo) e calcula a paginação. */
export function solveLayout(rooms: RoomCm[], tile: TileSpec, layout: LayoutSpec): LayoutResult {
  const valid = rooms.filter((r) => isSimple(r.ring));
  const origins: Record<string, Point> = {};
  if (layout.gridMode === 'global') {
    const o = layout.origin === 'auto' ? optimizeOrigin(valid, tile, layout) : layout.origin;
    for (const r of rooms) origins[r.id] = o;
  } else {
    for (const r of rooms) {
      origins[r.id] = r.origin ?? (isSimple(r.ring) ? optimizeOrigin([r], tile, layout) : { x: 0, y: 0 });
    }
  }
  return computeLayout(rooms, tile, layout, origins);
}
