import { tileRects } from '../tiling/grid';
import type { LayoutSpec, TileSpec } from '../tiling/types';
import { validateTile } from '../tiling/validate';
import { fmt, patternLabel } from './format';

/** Amostra de 3 × 2 m mostrando a peça, o rejunte e a paginação escolhida. */
export default function TilePreview({ tile, layout }: { tile: TileSpec; layout: LayoutSpec }) {
  if (validateTile(tile, layout).length > 0) {
    return <div className="center-msg">Preencha as medidas da peça para ver a amostra.</div>;
  }
  const area = { w: 300, h: 200 };
  const swap = layout.rotationDeg === 90;
  const frame = swap ? { x: 0, y: 0, w: area.h, h: area.w } : { x: 0, y: 0, ...area };
  // amostra exagera o rejunte para que ele apareça na tela
  const shown = { ...tile, jointMm: Math.max(tile.jointMm, 4) };
  const rects = tileRects(frame, { x: -7, y: -5 }, shown, layout).map(({ rect }) =>
    swap ? { x: rect.y, y: rect.x, w: rect.h, h: rect.w } : rect,
  );

  return (
    <figure className="tile-preview">
      <svg viewBox={`-10 -10 ${area.w + 20} ${area.h + 20}`} role="img" aria-label="Amostra da paginação">
        <defs>
          <clipPath id="amostra">
            <rect width={area.w} height={area.h} />
          </clipPath>
        </defs>
        <rect width={area.w} height={area.h} fill="#7d848a" />
        <g clipPath="url(#amostra)">
          {rects.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#d6dadd" />
          ))}
        </g>
        <rect width={area.w} height={area.h} fill="none" stroke="#22262a" strokeWidth={2} />
      </svg>
      <figcaption className="muted">
        Amostra de 3 × 2 m: peça de {fmt(tile.lengthCm)} × {fmt(tile.widthCm)} cm, {patternLabel(layout).toLowerCase()},
        comprimento na {swap ? 'vertical' : 'horizontal'}.
      </figcaption>
    </figure>
  );
}
