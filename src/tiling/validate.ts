import type { LayoutSpec, TileSpec } from './types';

/** Mensagens de erro do formulário do piso; lista vazia = válido. NaN conta como inválido. */
export function validateTile(tile: TileSpec, layout: LayoutSpec): string[] {
  const errors: string[] = [];
  if (!(tile.lengthCm > 0) || !(tile.widthCm > 0)) {
    errors.push('Informe o comprimento e a largura da peça.');
  } else if (tile.lengthCm < 2 || tile.widthCm < 2) {
    errors.push('Peças menores que 2 cm não são suportadas.');
  }
  if (!(tile.jointMm >= 0)) errors.push('O rejunte não pode ser negativo.');
  if (!(tile.piecesPerBox >= 1) && !((tile.m2PerBox ?? 0) > 0)) {
    errors.push('Informe quantas peças vêm por caixa (ou quantos m²).');
  }
  if (!(tile.wastePct >= 0 && tile.wastePct <= 50)) errors.push('A margem de perda deve ficar entre 0% e 50%.');
  if (layout.pattern === 'running') {
    const { kind, value } = layout.runningOffset;
    const ok = kind === 'fraction' ? value > 0 && value < 1 : value > 0 && value < tile.lengthCm;
    if (!ok) errors.push('O deslocamento da amarração deve ser maior que 0 e menor que o comprimento da peça.');
  }
  if (!(layout.minCutCm >= 0) || !(layout.minCutFraction >= 0 && layout.minCutFraction <= 0.5)) {
    errors.push('O limite de filete deve ficar entre 0 e metade da peça.');
  }
  return errors;
}
