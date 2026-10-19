import type { LayoutSummary, Piece, TileSpec } from './types';

export function piecesPerBox(tile: TileSpec): number {
  if (tile.piecesPerBox >= 1) return tile.piecesPerBox;
  if (tile.m2PerBox && tile.m2PerBox > 0) {
    return Math.max(1, Math.round(tile.m2PerBox / ((tile.lengthCm * tile.widthCm) / 10000)));
  }
  return 1;
}

export function summarize(all: Piece[], tile: TileSpec, floorAreaCm2: number): LayoutSummary {
  const pieces = all.filter((p) => !p.removed);
  let full = 0;
  let slivers = 0;
  let hidden = 0;
  let fromLeftovers = 0;
  for (const p of pieces) {
    if (p.kind === 'full') full++;
    if (p.kind === 'sliver') {
      if (p.hidden) hidden++;
      else slivers++;
    }
    if (p.fromLeftoverOf !== undefined) fromLeftovers++;
  }
  const newTiles = pieces.length - fromLeftovers;
  const tilesToBuy = Math.ceil(newTiles * (1 + tile.wastePct / 100) - 1e-9);
  const tileArea = tile.lengthCm * tile.widthCm;
  const bought = tilesToBuy * tileArea;
  return {
    areaM2: floorAreaCm2 / 10000,
    full,
    cut: pieces.length - full,
    slivers,
    hidden,
    removed: all.length - pieces.length,
    fromLeftovers,
    newTiles,
    tilesToBuy,
    boxes: Math.ceil(tilesToBuy / piecesPerBox(tile)),
    wastePct: bought > 0 ? Math.max(0, (1 - floorAreaCm2 / bought) * 100) : 0,
  };
}
