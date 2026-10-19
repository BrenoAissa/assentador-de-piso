import type { CutType, LayoutSpec, Piece } from '../tiling/types';

export const fmt = (v: number, digits = 1) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const fmtFixed = (v: number, digits: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Nome do encaixe das fileiras, no vocabulário da tela (Alinhado, Tijolinho, Escada). */
export function patternLabel(layout: LayoutSpec): string {
  if (layout.pattern === 'straight') return 'Alinhado';
  const { kind, value } = layout.runningOffset;
  if (kind === 'cm') return `Deslocado ${fmt(value)} cm`;
  if (Math.abs(value - 1 / 2) < 1e-6) return 'Tijolinho';
  if (Math.abs(value - 1 / 3) < 1e-6) return 'Escada';
  if (Math.abs(value - 1 / 4) < 1e-6) return 'Deslocado 1/4';
  return `Deslocado ${fmt(value * 100, 0)}%`;
}

/** "peça deitada" / "peça em pé"; vazio para peça quadrada. */
export function orientationLabel(tile: { lengthCm: number; widthCm: number }, layout: LayoutSpec): string {
  if (Math.abs(tile.lengthCm - tile.widthCm) < 0.01) return '';
  return layout.rotationDeg === 90 ? 'peça em pé' : 'peça deitada';
}

export const CUT_TYPE_LABEL: Record<CutType, string> = {
  straight: 'Reto',
  corner: 'Canto (2 cortes)',
  shaped: 'Irregular',
};

/** Medida do recorte em cm: só o lado cortado quando o corte é reto. */
export function cutLabel(p: Piece): string {
  if (!p.cutSize) return '';
  const { w, h } = p.cutSize;
  const fullW = Math.abs(w - p.tileRect.w) < 0.05;
  const fullH = Math.abs(h - p.tileRect.h) < 0.05;
  if (p.cutType === 'straight' && fullH) return `${fmt(w)} cm`;
  if (p.cutType === 'straight' && fullW) return `${fmt(h)} cm`;
  return `${fmt(w)} × ${fmt(h)} cm`;
}
