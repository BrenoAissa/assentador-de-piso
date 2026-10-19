import type { LayoutResult, RoomCm } from '../tiling/types';
import { CUT_TYPE_LABEL, cutLabel } from '../ui/format';

interface Props {
  result: LayoutResult;
  rooms: RoomCm[];
  selected?: string | null;
  onSelect?: (key: string) => void;
}

export default function CutTable({ result, rooms, selected, onSelect }: Props) {
  const names = new Map(rooms.map((r) => [r.id, r.name]));
  const cuts = result.pieces.filter((p) => p.kind !== 'full' && !p.removed);
  if (cuts.length === 0) return <p className="muted">Nenhum recorte: todas as peças entram inteiras.</p>;

  return (
    <table className="cut-table">
      <caption className="muted">
        {cuts.length} recortes. As {result.summary.full} peças inteiras não aparecem na lista.
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
