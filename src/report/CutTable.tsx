import type { Piece, ProjectLayout, RoomCm } from '../tiling/types';
import { CUT_TYPE_LABEL, cutLabel } from '../ui/format';

interface Props {
  layout: ProjectLayout;
  /** Nome de cada piso; com um piso só, a lista fica sem título. */
  floorNames: Record<string, string>;
  rooms: RoomCm[];
  selected?: string | null;
  onSelect?: (key: string) => void;
}

/** Lista de recortes, uma seção por piso (cada piso é cortado com a sua peça). */
export default function CutTable({ layout, floorNames, rooms, selected, onSelect }: Props) {
  const names = new Map(rooms.map((r) => [r.id, r.name]));
  const many = layout.floors.length > 1;
  return (
    <>
      {layout.floors.map(({ floorId, result }) => (
        <section key={floorId} className="cut-section">
          {many && <h3>{floorNames[floorId]}</h3>}
          <FloorCuts pieces={layout.pieces.filter((p) => p.floorId === floorId)} full={result.summary.full} names={names} selected={selected} onSelect={onSelect} />
        </section>
      ))}
    </>
  );
}

function FloorCuts({
  pieces,
  full,
  names,
  selected,
  onSelect,
}: {
  pieces: Piece[];
  full: number;
  names: Map<string, string>;
  selected?: string | null;
  onSelect?: (key: string) => void;
}) {
  const cuts = pieces.filter((p) => p.kind !== 'full' && !p.removed);
  if (cuts.length === 0) return <p className="muted">Nenhum recorte: todas as peças entram inteiras.</p>;

  return (
    <table className="cut-table">
      <caption className="muted">
        {cuts.length} recortes. As {full} peças inteiras não aparecem na lista.
      </caption>
      <thead>
        <tr>
          <th scope="col">Peça</th>
          <th scope="col">Cômodo</th>
          <th scope="col">Medida que fica</th>
          <th scope="col">Corte</th>
          <th scope="col">Sai de</th>
        </tr>
      </thead>
      <tbody>
        {cuts.map((p) => (
          <tr
            key={p.key}
            aria-selected={p.key === selected}
            className={p.kind === 'sliver' ? 'is-sliver' : undefined}
            onClick={() => onSelect?.(p.key)}
          >
            <td>{p.n}</td>
            <td>{names.get(p.roomId)}</td>
            <td>
              {cutLabel(p)}
              {p.kind === 'sliver' && !p.hidden && <span className="badge badge-warn">filete</span>}
              {p.hidden && <span className="badge">embaixo de móvel</span>}
            </td>
            <td>{p.cutType ? CUT_TYPE_LABEL[p.cutType] : ''}</td>
            <td>{p.fromLeftoverOf !== undefined ? `Sobra da peça ${p.fromLeftoverOf}` : 'Peça nova'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
