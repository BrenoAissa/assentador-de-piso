import type { LayoutSummary, TileSpec } from '../tiling/types';
import { fmt, fmtFixed } from '../ui/format';

interface Props {
  summary: LayoutSummary;
  tile: TileSpec;
  /** Mostra os detalhes abertos (impressão). */
  expanded?: boolean;
  /** Nome do piso, quando o projeto tem mais de um. */
  title?: string;
}

export default function Summary({ summary: s, tile, expanded, title }: Props) {
  const details = (
    <dl className="summary">
      <div>
        <dt>Área de piso</dt>
        <dd>{fmtFixed(s.areaM2, 2)} m²</dd>
      </div>
      <div>
        <dt>Peças inteiras</dt>
        <dd>{s.full}</dd>
      </div>
      <div>
        <dt>Peças recortadas</dt>
        <dd>{s.cut}</dd>
      </div>
      <div>
        <dt>Saem de sobras</dt>
        <dd>{s.fromLeftovers}</dd>
      </div>
      {s.removed > 0 && (
        <div>
          <dt>Apagadas (móvel fixo)</dt>
          <dd>{s.removed}</dd>
        </div>
      )}
      <div>
        <dt>Desperdício</dt>
        <dd>{fmt(s.wastePct)}%</dd>
      </div>
    </dl>
  );

  return (
    <div className="summary2">
      {title && <h3 className="summary-title">{title}</h3>}
      <div className="buy">
        <span className="muted">Comprar</span>
        <strong>
          {s.boxes} {s.boxes === 1 ? 'caixa' : 'caixas'}
        </strong>
        <span className="muted">
          {s.tilesToBuy} peças, com {fmt(tile.wastePct)}% de folga para quebras
        </span>
      </div>
      <p className={s.slivers > 0 ? 'sliver-line bad' : 'sliver-line good'}>
        {s.slivers === 0 ? 'Nenhum filete à vista.' : s.slivers === 1 ? '1 filete à vista.' : `${s.slivers} filetes à vista.`}
        {s.hidden > 0 && <span className="muted"> {s.hidden === 1 ? '1 escondido' : `${s.hidden} escondidos`} embaixo de móvel.</span>}
      </p>
      {expanded ? (
        details
      ) : (
        <details className="details">
          <summary>Detalhes</summary>
          {details}
        </details>
      )}
    </div>
  );
}
