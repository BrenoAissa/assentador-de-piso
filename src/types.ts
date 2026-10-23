import { FIRST_FLOOR_ID, newFloor } from './floors';
import type { Point, Ring } from './geometry/types';
import { NO_EDITS, type LayoutSpec, type ManualEdits, type TileSpec } from './tiling/types';

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
  /** Peça da entrada no modo por cômodo (ponto tocado, em cm). */
  start?: Point;
  /** Piso que o cômodo recebe; ausente (ou de um piso apagado) = o primeiro piso. */
  floorId?: string;
}

/** Um piso do projeto: a peça e como ela é assentada. Cada piso é uma compra separada. */
export interface Floor {
  id: string;
  name: string;
  tile: TileSpec;
  layout: LayoutSpec;
}

export interface Project {
  version: 1;
  plan: PlanImage | null;
  scale: Scale | null;
  rooms: Room[];
  /** Pisos do projeto, sempre pelo menos um. */
  floors: Floor[];
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

/**
 * Completa projetos salvos por versões anteriores: sem `edits` (antes dos ajustes manuais) ou
 * com uma peça e um layout só (antes dos pisos), que viram o primeiro piso.
 */
export function normalizeProject(p: Project): Project {
  const { tile, layout, ...rest } = p as Project & { tile?: TileSpec; layout?: LayoutSpec };
  const floors = rest.floors?.length ? rest.floors : [newFloor(FIRST_FLOOR_ID, tile, layout)];
  return { ...rest, floors, edits: rest.edits ?? NO_EDITS };
}

export function emptyProject(): Project {
  return {
    version: 1,
    plan: null,
    scale: null,
    rooms: [],
    floors: [newFloor(FIRST_FLOOR_ID)],
    edits: NO_EDITS,
  };
}
