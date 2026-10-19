import type { Point, Ring } from './geometry/types';
import { DEFAULT_LAYOUT, DEFAULT_TILE, NO_EDITS, type LayoutSpec, type ManualEdits, type TileSpec } from './tiling/types';

export type { LayoutSpec, ManualEdits, TileSpec };

export interface PlanImage {
  /** Chave da imagem no IndexedDB (vazia num projeto desenhado). */
  imageId: string;
  /** 'drawn': planta desenhada no app, sem imagem, com 1 px = 1 cm. */
  kind?: 'image' | 'drawn';
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
  /** Ajustes manuais de fileiras e peças sobre a grade atual. */
  edits: ManualEdits;
}

export const isDrawn = (p: Project) => p.plan?.kind === 'drawn';

/** Prancheta de um projeto desenhado do zero: 15 × 10 m, escala real (1 px = 1 cm). */
export function drawnPlan(): { plan: PlanImage; scale: Scale } {
  return {
    plan: { imageId: '', kind: 'drawn', widthPx: 1500, heightPx: 1000, sourceName: 'Desenho' },
    scale: { pxPerCm: 1, source: 'manual', confidence: 1 },
  };
}

/** Projetos salvos antes dos ajustes manuais não têm `edits`. */
export function normalizeProject(p: Project): Project {
  return { ...p, edits: p.edits ?? NO_EDITS };
}

export function emptyProject(): Project {
  return {
    version: 1,
    plan: null,
    scale: null,
    rooms: [],
    tile: { ...DEFAULT_TILE },
    layout: { ...DEFAULT_LAYOUT },
    edits: NO_EDITS,
  };
}
