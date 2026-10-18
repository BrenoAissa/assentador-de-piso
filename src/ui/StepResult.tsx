import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Point } from '../geometry/types';
import CutTable from '../report/CutTable';
import Compare from '../report/Compare';
import Plan2D from '../report/Plan2D';
import { PIECE_FILL } from '../report/PlanSvg';
import PrintSheet from '../report/PrintSheet';
import Summary from '../report/Summary';
import { roomsInCm } from '../store/issues';
import { useProject } from '../store/project';
import { solveInWorker } from '../tiling/client';
import { computeLayout } from '../tiling/engine';
import type { LayoutResult } from '../tiling/types';
import { CUT_TYPE_LABEL, cutLabel } from './format';
import LayoutControls from './LayoutControls';

export type ResultTab = '3d' | '2d' | 'cuts' | 'compare';

const TABS: { id: ResultTab; label: string }[] = [
  { id: '3d', label: '3D' },
  { id: '2d', label: 'Planta 2D' },
  { id: 'cuts', label: 'Recortes' },
  { id: 'compare', label: 'Comparar paginações' },
];

const MANY_PIECES = 20000;

const Scene = lazy(() => import('../viewer3d/Scene'));

export default function StepResult() {
  const project = useProject((s) => s.project);
  const result = useProject((s) => s.result);
  const { setResult, setLayout, setStep } = useProject.getState();
  const rooms = useMemo(() => roomsInCm(project), [project]);
  const [tab, setTab] = useState<ResultTab>('3d');
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<LayoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (result || rooms.length === 0) return;
    let alive = true;
    setError(null);
    solveInWorker(rooms, project.tile, project.layout)
      .then((r) => {
        if (alive && useProject.getState().project === project) {
          setResult(r);
          setPreview(null);
        }
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [project, result, rooms, setResult]);

  const shown = preview ?? result;
  const selPiece = selected !== null ? shown?.pieces.find((p) => p.n === selected) : undefined;
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? '';
  const global = project.layout.gridMode === 'global';

  const onOriginDrag = (o: Point, done: boolean) => {
    if (done) {
      setLayout({ origin: o });
      return;
    }
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const origins = Object.fromEntries(rooms.map((r) => [r.id, o]));
      setPreview(computeLayout(rooms, project.tile, { ...project.layout, origin: o }, origins));
    });
  };

  return (
    <div className="workspace">
      <div className="result-main">
        <div className="tabs" role="tablist" aria-label="Visualização">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="result-view">
          {error ? (
            <div className="center-msg error">{error}</div>
          ) : !shown ? (
            <div className="center-msg">Montando o quebra-cabeça…</div>
          ) : tab === '3d' ? (
            <Suspense fallback={<div className="center-msg">Carregando o 3D…</div>}>
              <Scene result={shown} rooms={rooms} selected={selected} onSelect={setSelected} />
            </Suspense>
          ) : tab === '2d' ? (
            <Plan2D
              result={shown}
              rooms={rooms}
              tile={project.tile}
              selected={selected}
              onSelect={setSelected}
              onOriginDrag={global ? onOriginDrag : undefined}
            />
          ) : tab === 'cuts' ? (
            <div className="scroll-pane">
              <CutTable result={shown} rooms={rooms} selected={selected} onSelect={setSelected} />
            </div>
          ) : (
            <div className="scroll-pane">
              <Compare />
            </div>
          )}
        </div>
      </div>

      <aside className="panel" aria-label="Resultado">
        <section className="panel-section">
          <h3>Resumo</h3>
          {shown ? <Summary summary={shown.summary} tile={project.tile} /> : <p className="muted">Calculando…</p>}
          {shown && shown.pieces.length > MANY_PIECES && (
            <p className="error">São mais de {MANY_PIECES.toLocaleString('pt-BR')} peças; o 3D mostra uma versão simplificada.</p>
          )}
          {shown?.warnings.map((w) => (
            <p key={w} className="error">
              {w}
            </p>
          ))}
          <ul className="legend">
            <li>
              <i style={{ background: PIECE_FILL.full }} /> Inteira
            </li>
            <li>
              <i style={{ background: PIECE_FILL.cut }} /> Recortada
            </li>
            <li>
              <i style={{ background: PIECE_FILL.sliver }} /> Filete
            </li>
            <li>
              <i className="dashed" style={{ background: PIECE_FILL.cut }} /> Sai de sobra
            </li>
          </ul>
        </section>

        <section className="panel-section">
          {selPiece ? (
            <>
              <div className="scale-line">
                <h3>Peça {selPiece.n}</h3>
                <button className="btn btn-quiet btn-sm" onClick={() => setSelected(null)}>
                  Fechar
                </button>
              </div>
              <p>
                {roomName(selPiece.roomId)}:{' '}
                {selPiece.kind === 'full'
                  ? 'peça inteira'
                  : `${selPiece.kind === 'sliver' ? 'filete' : 'recorte'} ${selPiece.cutType ? CUT_TYPE_LABEL[selPiece.cutType].toLowerCase() : ''}, fica com ${cutLabel(selPiece)}`}
                .
              </p>
              {selPiece.kind !== 'full' && (
                <p className="muted">
                  {selPiece.fromLeftoverOf !== undefined
                    ? `Corte esta peça da sobra da peça ${selPiece.fromLeftoverOf}.`
                    : 'Use uma peça nova. O lado cortado vai contra a parede.'}
                </p>
              )}
            </>
          ) : (
            <p className="muted">Clique numa peça para ver o número, a medida do recorte e de onde ela sai.</p>
          )}
        </section>

        <section className="panel-section">
          <LayoutControls />
          {global && (
            <div className="scale-line">
              <span className="muted">
                Ponto de partida: {project.layout.origin === 'auto' ? 'automático (menos filetes)' : 'escolhido por você'}
              </span>
              {project.layout.origin !== 'auto' && (
                <button className="btn btn-sm" onClick={() => setLayout({ origin: 'auto' })}>
                  Otimizar de novo
                </button>
              )}
            </div>
          )}
        </section>

        <footer className="panel-footer">
          <div className="row">
            <button className="btn" onClick={() => setStep(3)}>
              Mudar o piso
            </button>
            <button className="btn btn-primary" disabled={!result} onClick={() => window.print()}>
              Imprimir para a obra
            </button>
          </div>
        </footer>
      </aside>

      {result && <PrintSheet result={result} rooms={rooms} tile={project.tile} layout={project.layout} />}
    </div>
  );
}
