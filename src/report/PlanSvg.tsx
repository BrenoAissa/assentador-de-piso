import { memo } from 'react';
import { bbox } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import type { LayoutResult, Piece, RoomCm } from '../tiling/types';
import { cutLabel } from '../ui/format';

export const PIECE_FILL: Record<Piece['kind'], string> = {
  full: '#c9ced2',
  cut: '#8db3e2',
  sliver: '#ee8a7f',
};

/** Peça marcada como embaixo de móvel. */
export const HIDDEN_FILL = '#cbbfe3';

export function pieceFill(p: Piece): string {
  if (p.removed) return '#ffffff';
  if (p.hidden) return HIDDEN_FILL;
  return PIECE_FILL[p.kind];
}

const pts = (ring: Ring) => ring.map((q) => `${q.x},${q.y}`).join(' ');

interface Props {
  result: LayoutResult;
  rooms: RoomCm[];
  /** Tamanho da fonte em cm (unidades do desenho). */
  fontSize: number;
  showNumbers: boolean;
  showCuts: boolean;
  /** Espessura das linhas finas em px de tela (non-scaling) ou em cm na impressão. */
  hairline: number;
  scalingStroke?: boolean;
}

/** Conteúdo da planta paginada em cm: base de rejunte, peças, paredes e rótulos. */
function PlanSvg({ result, rooms, fontSize, showNumbers, showCuts, hairline, scalingStroke }: Props) {
  const ve = scalingStroke ? undefined : ('non-scaling-stroke' as const);
  return (
    <>
      {rooms.map((r) => (
        <polygon key={`b${r.id}`} points={pts(r.ring)} fill="#6b7177" />
      ))}
      {result.pieces.map((p) => {
        const fromLeftover = p.fromLeftoverOf !== undefined && !p.removed;
        return (
          <g key={p.key} data-piece={p.key}>
            {p.shape.map((ring, i) => (
              <polygon
                key={i}
                points={pts(ring)}
                fill={pieceFill(p)}
                stroke={p.removed ? '#5f666c' : fromLeftover ? '#1f4f8a' : '#ffffff'}
                strokeWidth={fromLeftover || p.removed ? hairline * 1.6 : hairline}
                strokeDasharray={fromLeftover || p.removed ? `${hairline * 4} ${hairline * 3}` : undefined}
                vectorEffect={ve}
              />
            ))}
          </g>
        );
      })}
      {rooms.map((r) => (
        <polygon
          key={`w${r.id}`}
          points={pts(r.ring)}
          fill="none"
          stroke="#22262a"
          strokeWidth={hairline * 3.5}
          vectorEffect={ve}
          pointerEvents="none"
        />
      ))}
      {showNumbers && (
        <g pointerEvents="none" fontFamily="inherit" textAnchor="middle" fill="#22262a">
          {result.pieces
            .filter((p) => !p.removed)
            .map((p) => {
              const b = bbox(p.shape);
              const cx = b.x + b.w / 2;
              const cy = b.y + b.h / 2;
              const cut = showCuts && p.kind !== 'full' ? cutLabel(p) : '';
              const small = Math.min(b.w, b.h) < fontSize * 1.6;
              return (
                <text
                  key={p.key}
                  x={cx}
                  y={cy + (cut && !small ? -fontSize * 0.15 : fontSize * 0.35)}
                  fontSize={small ? fontSize * 0.7 : fontSize}
                  fontWeight={650}
                >
                  {p.n}
                  {cut && !small && (
                    <tspan x={cx} dy={fontSize * 0.95} fontSize={fontSize * 0.72} fontWeight={450}>
                      {cut}
                    </tspan>
                  )}
                </text>
              );
            })}
        </g>
      )}
    </>
  );
}

export default memo(PlanSvg);
