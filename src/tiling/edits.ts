import { bbox, isAxisRect } from '../geometry/polygon';
import type { Piece } from './types';

const TOL = 0.1;

export const rowKey = (roomId: string, row: number) => `${roomId}:${row}`;
export const pieceKey = (roomId: string, row: number, col: number) => `${roomId}:${row}:${col}`;

/** Tira `col` da ordem e põe na posição `index` da lista que sobrou. */
export function moveInOrder(order: number[], col: number, index: number): number[] {
  const rest = order.filter((c) => c !== col);
  const i = Math.max(0, Math.min(rest.length, index));
  return [...rest.slice(0, i), col, ...rest.slice(i)];
}

/** Posição de inserção: quantos centros (das outras peças) ficam antes de `pos`. */
export function targetIndex(centers: number[], pos: number): number {
  return centers.filter((c) => c < pos).length;
}

/**
 * A fileira (peças de um cômodo numa mesma fileira, no referencial da paginação) é uma faixa
 * reta e contínua de peças retangulares de mesma altura? Só assim dá para reordenar sem
 * buraco nem sobreposição.
 */
export function rowIsStrip(row: Piece[], joint: number): boolean {
  if (row.length < 2) return false;
  const boxes = row.map((p) => bbox(p.shape)).sort((a, b) => a.x - b.x);
  if (!row.every((p) => p.shape.length === 1 && isAxisRect(p.shape[0]))) return false;
  const { y, h } = boxes[0];
  if (!boxes.every((b) => Math.abs(b.y - y) < TOL && Math.abs(b.h - h) < TOL)) return false;
  for (let i = 1; i < boxes.length; i++) {
    if (Math.abs(boxes[i].x - (boxes[i - 1].x + boxes[i - 1].w) - joint) > TOL) return false;
  }
  return true;
}

/**
 * Reacomoda a fileira na ordem pedida (referencial da paginação): mesma faixa, mesmas peças,
 * rejunte entre elas. Devolve false (sem mexer) se a fileira não for uma faixa reta ou se a
 * ordem não tiver exatamente as colunas da fileira.
 */
export function applyRowOrder(row: Piece[], order: number[], joint: number): boolean {
  const cols = row.map((p) => p.col).sort((a, b) => a - b);
  const wanted = [...order].sort((a, b) => a - b);
  if (cols.length !== wanted.length || cols.some((c, i) => c !== wanted[i])) return false;
  if (!rowIsStrip(row, joint)) return false;
  const byCol = new Map(row.map((p) => [p.col, p]));
  let cursor = Math.min(...row.map((p) => bbox(p.shape).x));
  for (const col of order) {
    const p = byCol.get(col)!;
    const b = bbox(p.shape);
    p.shape = [
      [
        { x: cursor, y: b.y },
        { x: cursor + b.w, y: b.y },
        { x: cursor + b.w, y: b.y + b.h },
        { x: cursor, y: b.y + b.h },
      ],
    ];
    // a peça inteira de onde ela sai continua do mesmo tamanho; o lado que sobra fica à direita
    p.tileRect = { ...p.tileRect, x: cursor };
    cursor += b.w + joint;
  }
  return true;
}
