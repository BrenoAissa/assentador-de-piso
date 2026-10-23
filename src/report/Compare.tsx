import { useEffect, useState } from 'react';
import { floorInputs } from '../store/issues';
import { useProject } from '../store/project';
import { compareInWorker } from '../tiling/client';
import type { PatternOption } from '../tiling/compare';
import { fmt, patternLabel } from '../ui/format';

/** Compara os três encaixes no piso `floorId`. */
export default function Compare({ floorId }: { floorId: string }) {
  const project = useProject((s) => s.project);
  const input = floorInputs(project).find((f) => f.id === floorId);
  const setLayout = useProject((s) => s.setLayout);
  const [options, setOptions] = useState<PatternOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setOptions(null);
    setError(null);
    if (!input) return;
    compareInWorker(input.rooms, input.tile, input.layout)
      .then((o) => alive && setOptions(o))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [project, floorId]);

  if (!input) return <p className="muted">Nenhum cômodo com este piso.</p>;
  if (error) return <p className="error">{error}</p>;
  if (!options) return <p className="muted">Calculando os três encaixes…</p>;

  const current = patternLabel(input.layout);
  const best = options.reduce((a, b) =>
    b.result.summary.slivers < a.result.summary.slivers ||
    (b.result.summary.slivers === a.result.summary.slivers && b.result.summary.tilesToBuy < a.result.summary.tilesToBuy)
      ? b
      : a,
  );

  return (
    <table className="cut-table compare-table">
      <caption className="muted">
        Cada encaixe usa o melhor ponto de partida para ele, sem os seus ajustes manuais. Mesma peça, rejunte e direção.
      </caption>
      <thead>
        <tr>
          <th scope="col">Encaixe</th>
          <th scope="col">Inteiras</th>
          <th scope="col">Recortes</th>
          <th scope="col">Filetes</th>
          <th scope="col">Comprar</th>
          <th scope="col">Desperdício</th>
          <th scope="col" />
        </tr>
      </thead>
      <tbody>
        {options.map((o) => {
          const s = o.result.summary;
          const isCurrent = o.label === current;
          return (
            <tr key={o.label} aria-selected={isCurrent}>
              <td>
                {o.label}
                {o === best && <span className="badge badge-ok">menos perda</span>}
              </td>
              <td>{s.full}</td>
              <td>{s.cut}</td>
              <td className={s.slivers > 0 ? 'bad' : undefined}>{s.slivers}</td>
              <td>
                {s.boxes} cx ({s.tilesToBuy} peças)
              </td>
              <td>{fmt(s.wastePct)}%</td>
              <td>
                {isCurrent ? (
                  <span className="muted">em uso</span>
                ) : (
                  <button
                    className="btn btn-sm"
                    onClick={() => setLayout(floorId, { pattern: o.layout.pattern, runningOffset: o.layout.runningOffset, origin: 'auto' })}
                  >
                    Usar esta
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
