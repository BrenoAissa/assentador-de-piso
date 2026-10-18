import type { Point, Rect, Ring } from '../geometry/types';

export interface TileSpec {
  /** Lado maior, em cm. */
  lengthCm: number;
  /** Lado menor, em cm (igual ao maior em placa quadrada). */
  widthCm: number;
  /** Rejunte em mm; 0 para régua sem rejunte. */
  jointMm: number;
  piecesPerBox: number;
  m2PerBox?: number;
  /** Margem de perda em %. */
  wastePct: number;
}

export type RunningOffset = { kind: 'fraction'; value: number } | { kind: 'cm'; value: number };

export interface LayoutSpec {
  pattern: 'straight' | 'running';
  runningOffset: RunningOffset;
  /** 0 = comprimento da peça na horizontal da planta. */
  rotationDeg: 0 | 90;
  gridMode: 'global' | 'perRoom';
  origin: Point | 'auto';
  minCutCm: number;
  minCutFraction: number;
  /** Perda do disco de corte, em cm. */
  kerfCm: number;
}

export interface RoomCm {
  id: string;
  name: string;
  ring: Ring;
  /** Origem da grade do cômodo no modo por cômodo; ausente = automática. */
  origin?: Point;
}

export type PieceKind = 'full' | 'cut' | 'sliver';
export type CutType = 'straight' | 'corner' | 'shaped';

export interface Piece {
  /** Número exibido, único no projeto. */
  n: number;
  roomId: string;
  /** Fileira e posição na fileira, no referencial da paginação. */
  row: number;
  col: number;
  /** Retângulo da peça inteira, em cm. */
  tileRect: Rect;
  /** Parte que fica no cômodo: anéis externos disjuntos. */
  shape: Ring[];
  kind: PieceKind;
  cutType?: CutType;
  /** Medida do recorte (caixa envolvente da parte que fica). */
  cutSize?: { w: number; h: number };
  /** Número da peça cuja sobra foi usada. */
  fromLeftoverOf?: number;
}

export interface LayoutSummary {
  areaM2: number;
  full: number;
  /** Todas as recortadas, filetes incluídos. */
  cut: number;
  /** Subconjunto de `cut`. */
  slivers: number;
  fromLeftovers: number;
  /** Peças novas necessárias, sem a margem de perda. */
  newTiles: number;
  tilesToBuy: number;
  boxes: number;
  /** % da área comprada que não vira piso. */
  wastePct: number;
}

export interface LayoutResult {
  pieces: Piece[];
  summary: LayoutSummary;
  originUsed: Point;
  roomOrigins: Record<string, Point>;
  warnings: string[];
}

export const DEFAULT_TILE: TileSpec = {
  lengthCm: 60,
  widthCm: 60,
  jointMm: 2,
  piecesPerBox: 4,
  wastePct: 10,
};

export const DEFAULT_LAYOUT: LayoutSpec = {
  pattern: 'straight',
  runningOffset: { kind: 'fraction', value: 0.5 },
  rotationDeg: 0,
  gridMode: 'global',
  origin: 'auto',
  minCutCm: 5,
  minCutFraction: 1 / 3,
  kerfCm: 0.3,
};
