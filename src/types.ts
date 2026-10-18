import type { Point, Ring } from './geometry/types';
import { DEFAULT_LAYOUT, DEFAULT_TILE, type LayoutSpec, type TileSpec } from './tiling/types';

export type { LayoutSpec, TileSpec };

export interface PlanImage {
  /** Chave da imagem no IndexedDB. */
  imageId: string;
  widthPx: number;
  heightPx: number;
  sourceName: string;
  pdfPage?: number;
}

export interface Scale {
  pxPerCm: number;
  source: 'ocr' | 'manual';
  /** 0..1 */
  confidence: number;
}

export type RoomIssue = 'low-confidence' | 'scale-mismatch' | 'unnamed' | 'invalid-polygon';

export interface Room {
  id: string;
  name: string;
  /** Contorno interno das paredes, em px da imagem original. */
  polygonPx: Ring;
  receivesTile: boolean;
  /** Só para cômodos detectados; some quando o usuário confere o contorno. */
  confidence?: number;
  issues: RoomIssue[];
  /** Origem da grade no modo por cômodo; ausente = automática. */
  origin?: Point;
}

export interface Project {
  version: 1;
  plan: PlanImage | null;
  scale: Scale | null;
  rooms: Room[];
  tile: TileSpec;
  layout: LayoutSpec;
}

export function emptyProject(): Project {
  return {
    version: 1,
    plan: null,
    scale: null,
    rooms: [],
    tile: { ...DEFAULT_TILE },
    layout: { ...DEFAULT_LAYOUT },
  };
}
