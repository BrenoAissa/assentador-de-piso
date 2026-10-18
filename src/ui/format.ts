import type { CutType, LayoutSpec, Piece } from '../tiling/types';

export const fmt = (v: number, digits = 1) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const fmtFixed = (v: number, digits: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function patternLabel(layout: LayoutSpec): string {
  if (layout.pattern === 'straight') return 'Reta';
  const { kind, value } = layout.runningOffset;
  if (kind === 'cm') return `Amarração de ${fmt(value)} cm`;
  const known: [number, string][] = [
    [1 / 2, '1/2'],
    [1 / 3, '1/3'],
    [1 / 4, '1/4'],
  ];
  const hit = known.find(([f]) => Math.abs(f - value) < 1e-6);
  return `Amarração ${hit ? hit[1] : `${fmt(value * 100, 0)}%`}`;
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
