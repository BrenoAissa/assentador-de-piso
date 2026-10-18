import type { LayoutSummary, TileSpec } from '../tiling/types';
import { fmt, fmtFixed } from '../ui/format';

export default function Summary({ summary, tile }: { summary: LayoutSummary; tile: TileSpec }) {
  const s = summary;
  return (
    <dl className="summary">
      <div className="summary-main">
        <dt>Comprar</dt>
        <dd>
          {s.boxes} {s.boxes === 1 ? 'caixa' : 'caixas'}
        </dd>
        <p className="muted">
          {s.tilesToBuy} peças, já com {fmt(tile.wastePct)}% de margem para quebras
        </p>
      </div>
      <div>
        <dt>Área de piso</dt>
        <dd>{fmtFixed(s.areaM2, 2)} m²</dd>
      </div>
      <div>
        <dt>Peças inteiras</dt>
        <dd>{s.full}</dd>
      </div>
      <div>
        <dt>Recortes</dt>
        <dd>{s.cut}</dd>
      </div>
      <div>
        <dt>Filetes</dt>
        <dd className={s.slivers > 0 ? 'bad' : undefined}>{s.slivers}</dd>
      </div>
      <div>
        <dt>Saem de sobras</dt>
        <dd>{s.fromLeftovers}</dd>
      </div>
      <div>
        <dt>Desperdício</dt>
        <dd>{fmt(s.wastePct)}%</dd>
      </div>
    </dl>
  );
}
