import type { Ring } from '../geometry/types';
import type { Scale } from '../types';

/** Imagem binária: 1 = tinta/parede, 0 = fundo. */
export type Mask = { w: number; h: number; data: Uint8Array };
export type Gray = { w: number; h: number; data: Uint8Array };
export type RGBAImage = { width: number; height: number; data: Uint8ClampedArray };

export interface DetectOptions {
  /** Multiplica o tamanho máximo de vão fechado automaticamente (0,5–2). */
  sensitivity?: number;
  mode?: 'auto' | 'filled' | 'outline';
}

export interface CvRoom {
  polygonPx: Ring;
  confidence: number;
}

export interface CvResult {
  rooms: CvRoom[];
  wallThicknessPx: number;
  mode: 'filled' | 'outline';
  warnings: string[];
}

export interface LinearDim {
  valueM: number;
  /** Texto girado (cota vertical na planta). */
  vertical: boolean;
}

export interface DetectedRoom extends CvRoom {
  name?: string;
  dims?: { a: number; b: number };
  areaM2?: number;
  /** Cotas lineares lidas dentro do cômodo (ex.: 3.31). */
  linear?: LinearDim[];
  scaleMismatch?: boolean;
}

export interface DetectionResult {
  rooms: DetectedRoom[];
  scale: Scale | null;
  wallThicknessPx: number;
  mode: 'filled' | 'outline';
  warnings: string[];
}
