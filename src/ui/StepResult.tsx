import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { bbox, pointInPolygon, swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import CutTable from '../report/CutTable';
import Compare from '../report/Compare';
import Plan2D, { type MontarTool } from '../report/Plan2D';
import { HIDDEN_FILL, PIECE_FILL } from '../report/PlanSvg';
import PrintSheet from '../report/PrintSheet';
import Summary from '../report/Summary';
import { toggleKey } from '../store/edits';
import { roomsInCm } from '../store/issues';
import { useProject } from '../store/project';
import { solveInWorker } from '../tiling/client';
import { moveInOrder, rowIsStrip, rowKey, targetIndex } from '../tiling/edits';
import { computeLayout } from '../tiling/engine';
import { pitch } from '../tiling/grid';
import { floorSnap, rowSnap, type RowMatch, type WallGuide } from '../tiling/snap';
import type { LayoutResult, ManualEdits, Piece } from '../tiling/types';
import { CUT_TYPE_LABEL, cutLabel, fmt } from './format';
import { OrientationPicker, PatternPicker } from './LayoutPickers';
import SampleNotice from './SampleNotice';

export type ResultTab = 'montar' | '3d' | 'cuts' | 'compare';

const TABS: { id: ResultTab; label: string }[] = [
  { id: 'montar', label: 'Montar' },
  { id: '3d', label: '3D' },
  { id: 'cuts', label: 'Lista de recortes' },
  { id: 'compare', label: 'Comparar encaixes' },
];

/** `short`: nome na faixa de ferramentas do celular, acima da planta. */
const TOOLS: { id: MontarTool; label: string; short: string }[] = [
  { id: 'start', label: 'Marcar a entrada', short: 'Entrada' },
  { id: 'floor', label: 'Arrastar o piso', short: 'Piso todo' },
  { id: 'row', label: 'Arrastar fileira', short: 'Fileira' },
  { id: 'piece', label: 'Mexer na peça', short: 'Peça' },
];

const MANY_PIECES = 20000;

const Scene = lazy(() => import('../viewer3d/Scene'));

const omit = <T,>(rec: Record<string, T>, key: string) => {
  const { [key]: _drop, ...rest } = rec;
  void _drop;
  return rest;
};

export default function StepResult() {
  const project = useProject((s) => s.project);
  const result = useProject((s) => s.result);
  const canUndo = useProject((s) => s.history.length > 0);
  const planUrl = useProject((s) => s.planUrl);
  const { setResult, setLayout, setEdits, undo, setStep, updateRoom } = useProject.getState();
  const { tile, layout, edits } = project;
  const rooms = useMemo(() => roomsInCm(project), [project]);
  const [tab, setTab] = useState<ResultTab>('montar');
  const [tool, setTool] = useState<MontarTool>('start');
  const [showFurniture, setShowFurniture] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<LayoutResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topView, setTopView] = useState<string | null>(null);
  const [guides, setGuides] = useState<WallGuide[]>([]);
  const [floorLabel, setFloorLabel] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<{ roomId: string; row: number; matches: RowMatch[]; free: boolean } | null>(null);
  const [printing, setPrinting] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    if (result || rooms.length === 0) return;
    let alive = true;
    setError(null);
    solveInWorker(rooms, tile, layout, edits)
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
  }, [project, result, rooms, tile, layout, edits, setResult]);

  // Ctrl+Z desfaz; Delete apaga a peça selecionada
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        setEdits({ ...useProject.getState().project.edits, removed: toggleKey(useProject.getState().project.edits.removed, selected) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, undo, setEdits]);

  const shown = preview ?? result;
  const selPiece = selected ? shown?.pieces.find((p) => p.key === selected) : undefined;
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? '';
  const global = layout.gridMode === 'global';
  const vertical = layout.rotationDeg === 90;
  const furniture =
    showFurniture && planUrl && project.plan && project.scale
      ? { url: planUrl, w: project.plan.widthPx / project.scale.pxPerCm, h: project.plan.heightPx / project.scale.pxPerCm }
      : null;

  /** Recalcula na hora, no próprio navegador, para o arraste acompanhar o mouse. */
  const previewWith = (origins: Record<string, Point>, nextEdits: ManualEdits) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setPreview(computeLayout(rooms, tile, layout, origins, nextEdits)));
  };

  const roomAt = (p: Point) => rooms.find((r) => pointInPolygon(p, r.ring));

  /** Guarda o ponto tocado como entrada; a montagem posiciona a grade para a peça dali ficar inteira. */
  const onStart = (p: Point) => {
    if (global) {
      setLayout({ start: p });
    } else {
      const room = roomAt(p);
      if (room) updateRoom(room.id, { start: p });
    }
    setSelected(null);
    setNotice(null);
  };

  const wallsLabel = (n: number) => (n === 0 ? null : n === 1 ? 'Peças inteiras encostadas nesta parede' : `Peças inteiras encostadas em ${n} paredes`);

  const onFloorDrag = (delta: Point, done: boolean, piece: Piece | undefined, tolCm: number) => {
    if (!result) return;
    const room = !global && piece ? rooms.find((r) => r.id === piece.roomId) : undefined;
    if (!global && !room) return;
    const base = global ? result.originUsed : result.roomOrigins[room!.id];
    const snap = floorSnap(global ? rooms : [room!], tile, layout, base, delta, tolCm);
    const o = { x: base.x + snap.delta.x, y: base.y + snap.delta.y };
    if (done) {
      setGuides([]);
      setFloorLabel(null);
      // arrastar o piso escolhe o começo à mão: a marca de entrada sai
      if (global) setLayout({ origin: o, start: undefined });
      else updateRoom(room!.id, { origin: o, start: undefined });
      return;
    }
    setGuides(snap.guides);
    setFloorLabel(wallsLabel(snap.guides.length) ?? (tolCm === 0 ? 'Livre, sem ímã' : 'Solte quando as peças encostarem onde você quer'));
    previewWith(global ? Object.fromEntries(rooms.map((r) => [r.id, o])) : { ...result.roomOrigins, [room!.id]: o }, edits);
  };

  const onRowDrag = (piece: Piece, delta: number, done: boolean, tolCm: number) => {
    if (!result) return;
    const room = rooms.find((r) => r.id === piece.roomId);
    if (!room) return;
    const key = rowKey(piece.roomId, piece.row);
    // fileiras vizinhas do mesmo cômodo, com o deslize que já tiverem, para alinhar as juntas
    const neighbours = [piece.row - 1, piece.row + 1]
      .filter((r) => result.pieces.some((p) => p.roomId === room.id && p.row === r))
      .map((r) => ({ row: r, extra: edits.rowShift[rowKey(room.id, r)] ?? 0 }));
    const snap = rowSnap(room, tile, layout, result.roomOrigins[room.id], piece.row, (edits.rowShift[key] ?? 0) + delta, tolCm, neighbours);
    const next: ManualEdits = {
      ...edits,
      rowShift: { ...edits.rowShift, [key]: snap.extra },
      rowOrder: omit(edits.rowOrder, key),
    };
    if (done) {
      setGuides([]);
      setDragRow(null);
      setEdits(next);
      return;
    }
    setGuides(snap.guides);
    setDragRow({ roomId: piece.roomId, row: piece.row, matches: snap.matches, free: tolCm === 0 });
    previewWith(result.roomOrigins, next);
  };

  /** "Pontas da fileira: inteira e 38 cm" para a fileira sendo arrastada. */
  const rowLabel = (() => {
    if (!dragRow || !shown) return null;
    const along = (p: Piece) => {
      const b = bbox(p.shape);
      return vertical ? { pos: b.y, len: b.h } : { pos: b.x, len: b.w };
    };
    const row = shown.pieces.filter((p) => p.roomId === dragRow.roomId && p.row === dragRow.row).sort((a, b) => along(a).pos - along(b).pos);
    if (row.length === 0) return null;
    // a fileira corre no comprimento da peça (a rotação só troca os eixos da planta)
    const L = tile.lengthCm;
    const end = (p: Piece) => (Math.abs(along(p).len - L) < 0.1 ? 'inteira' : `${fmt(along(p).len)} cm`);
    const text = `Pontas da fileira: ${end(row[0])} e ${end(row[row.length - 1])}`;
    const said: Record<RowMatch, string> = {
      wall: 'encostada na parede',
      aligned: 'juntas alinhadas com a vizinha',
      half: 'meio a meio com a vizinha',
      pattern: 'no encaixe original',
    };
    const extras = dragRow.matches.map((m) => said[m]);
    if (extras.length === 0 && dragRow.free) extras.push('livre, sem ímã');
    return [text, ...extras].join(', ');
  })();

  const onPieceDrop = (piece: Piece, axisPos: number) => {
    if (!shown) return;
    const along = (p: Piece) => {
      const b = bbox(p.shape);
      return vertical ? b.y + b.h / 2 : b.x + b.w / 2;
    };
    const row = shown.pieces.filter((p) => p.roomId === piece.roomId && p.row === piece.row).sort((a, b) => along(a) - along(b));
    const frameRow = vertical ? row.map((p) => ({ ...p, shape: p.shape.map(swapXY) })) : row;
    if (!rowIsStrip(frameRow, pitch(tile).joint)) {
      setNotice('Esta fileira passa por um canto ou parede inclinada. Use "Arrastar fileira" para mexer nela.');
      return;
    }
    const others = row.filter((p) => p.key !== piece.key).map(along);
    const order = moveInOrder(
      row.map((p) => p.col),
      piece.col,
      targetIndex(others, axisPos),
    );
    if (order.every((c, i) => c === row[i].col)) return;
    setNotice(null);
    setEdits({ ...edits, rowOrder: { ...edits.rowOrder, [rowKey(piece.roomId, piece.row)]: order } });
  };

  /** Gera a vista 3D de cima, espera a imagem ficar pronta e só então abre a impressão. */
  const printSheet = async () => {
    if (!result) return;
    setPrinting(true);
    try {
      const { renderTopView } = await import('../viewer3d/snapshot');
      const url = renderTopView(result, rooms);
      const img = new Image();
      img.src = url;
      await img.decode();
      flushSync(() => setTopView(url));
    } catch {
      // sem WebGL a folha sai sem a vista 3D, mas sai
      flushSync(() => setTopView(null));
    } finally {
      setPrinting(false);
    }
    window.print();
  };

  const resetRow = (p: Piece) => {
    const key = rowKey(p.roomId, p.row);
    setEdits({ ...edits, rowShift: omit(edits.rowShift, key), rowOrder: omit(edits.rowOrder, key) });
  };
  const selDescription = selPiece
    ? `${roomName(selPiece.roomId)}: ${
        selPiece.removed
          ? 'apagada (sem piso aqui)'
          : selPiece.kind === 'full'
            ? 'peça inteira'
            : `${selPiece.kind === 'sliver' ? 'filete' : 'recorte'} ${selPiece.cutType ? CUT_TYPE_LABEL[selPiece.cutType].toLowerCase() : ''}, fica com ${cutLabel(selPiece)}`
      }`
    : '';
  const rowEdited = selPiece ? rowKey(selPiece.roomId, selPiece.row) in edits.rowShift || rowKey(selPiece.roomId, selPiece.row) in edits.rowOrder : false;

  return (
    <div className="workspace">
      <div className="result-main">
        <div className="tabs" role="tablist" aria-label="Visualização">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="result-view">
          {error ? (
            <div className="center-msg error">{error}</div>
          ) : !shown ? (
            <div className="center-msg">Montando o quebra-cabeça…</div>
          ) : tab === 'montar' ? (
            <Plan2D
              result={shown}
              rooms={rooms}
              tile={tile}
              layout={layout}
              tool={tool}
              furniture={furniture}
              selected={selected}
              onSelect={setSelected}
              onStart={onStart}
              onFloorDrag={onFloorDrag}
              onRowDrag={onRowDrag}
              onPieceDrop={onPieceDrop}
              onDragCancel={() => {
                cancelAnimationFrame(frame.current);
                setPreview(null);
                setGuides([]);
                setFloorLabel(null);
                setDragRow(null);
              }}
              guides={guides}
              dragLabel={dragRow ? rowLabel : floorLabel}
              overlay={
                <div className="montar-strip" role="toolbar" aria-label="Ferramentas de montagem">
                  {TOOLS.map((t) => (
                    <button key={t.id} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
                      {t.short}
                    </button>
                  ))}
                  <button className="undo" disabled={!canUndo} onClick={undo} aria-label="Desfazer" title="Desfazer">
                    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                      <path d="M7 5 3 9l4 4M3.5 9H12a5 5 0 0 1 0 10H9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {selPiece && (
                    <div className="piece-sheet" role="group" aria-label={`Peça ${selPiece.n}`}>
                      <p>
                        <strong>Peça {selPiece.n}.</strong> {selDescription}.
                      </p>
                      <div className="action-row">
                        <button className="btn btn-sm" onClick={() => setEdits({ ...edits, removed: toggleKey(edits.removed, selPiece.key) })}>
                          {selPiece.removed ? 'Repor peça' : 'Apagar'}
                        </button>
                        {!selPiece.removed && (
                          <button className="btn btn-sm" aria-pressed={!!selPiece.hidden} onClick={() => setEdits({ ...edits, hidden: toggleKey(edits.hidden, selPiece.key) })}>
                            Embaixo de móvel
                          </button>
                        )}
                        <button className="btn btn-sm btn-quiet" onClick={() => setSelected(null)}>
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              }
            />
          ) : tab === '3d' ? (
            <Suspense fallback={<div className="center-msg">Carregando o 3D…</div>}>
              <Scene result={shown} rooms={rooms} selected={selected} onSelect={setSelected} />
            </Suspense>
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
        <SampleNotice />
        <section className="panel-section">
          {shown ? <Summary summary={shown.summary} tile={tile} /> : <p className="muted">Calculando…</p>}
          {shown && shown.pieces.length > MANY_PIECES && (
            <p className="error">São mais de {MANY_PIECES.toLocaleString('pt-BR')} peças; o 3D mostra uma versão simplificada.</p>
          )}
          {shown?.warnings.map((w) => (
            <p key={w} className="error">
              {w}
            </p>
          ))}
        </section>

        <section className="panel-section">
          <div className="scale-line">
            <h3>Montar</h3>
            <button className="btn btn-sm" disabled={!canUndo} onClick={undo} title="Ctrl+Z">
              Desfazer
            </button>
          </div>
          <div className="tool-grid" role="toolbar" aria-label="Ferramentas de montagem">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                aria-pressed={tool === t.id}
                onClick={() => {
                  setTool(t.id);
                  setTab('montar');
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {notice && <p className="issue">{notice}</p>}
          {planUrl && (
            <label className="check">
              <input type="checkbox" checked={showFurniture} onChange={(e) => setShowFurniture(e.target.checked)} />
              Mostrar os móveis da planta
            </label>
          )}
          {global && (layout.origin !== 'auto' || layout.start) && (
            <div>
              <button className="btn btn-sm btn-quiet" onClick={() => setLayout({ origin: 'auto', start: undefined })}>
                {layout.start ? 'Tirar a entrada e deixar o app escolher (menos filetes)' : 'Deixar o app escolher o começo (menos filetes)'}
              </button>
            </div>
          )}
          {(layout.start || rooms.some((r) => r.start)) && shown && shown.summary.slivers > 0 && (
            <p className="muted">
              Para a peça da entrada ficar inteira, os filetes foram para as paredes do outro lado. Dá para escondê-los: em
              "Arrastar fileira", leve o filete para baixo de um móvel, ou toque na peça e marque "Fica embaixo de móvel".
            </p>
          )}
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
              <i style={{ background: HIDDEN_FILL }} /> Embaixo de móvel
            </li>
            <li>
              <i className="dashed" style={{ background: PIECE_FILL.cut }} /> Sai de sobra
            </li>
            {(layout.start || rooms.some((r) => r.start)) && (
              <li>
                <i className="entrance" /> Entrada
              </li>
            )}
          </ul>
        </section>

        {selPiece && (
          <section className="panel-section sel-piece-section">
            <div className="scale-line">
              <h3>Peça {selPiece.n}</h3>
              <button className="btn btn-quiet btn-sm" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>
            <p>{selDescription}.</p>
            {selPiece.kind !== 'full' && !selPiece.removed && (
              <p className="muted">
                {selPiece.fromLeftoverOf !== undefined
                  ? `Corte esta peça da sobra da peça ${selPiece.fromLeftoverOf}.`
                  : 'Use uma peça nova. O lado cortado vai contra a parede.'}
              </p>
            )}
            <div className="action-row">
              <button className="btn btn-sm" onClick={() => setEdits({ ...edits, removed: toggleKey(edits.removed, selPiece.key) })}>
                {selPiece.removed ? 'Repor peça' : 'Apagar peça'}
              </button>
              {!selPiece.removed && (
                <button className="btn btn-sm" aria-pressed={!!selPiece.hidden} onClick={() => setEdits({ ...edits, hidden: toggleKey(edits.hidden, selPiece.key) })}>
                  Fica embaixo de móvel
                </button>
              )}
              {rowEdited && (
                <button className="btn btn-sm btn-quiet" onClick={() => resetRow(selPiece)}>
                  Voltar a fileira ao normal
                </button>
              )}
            </div>
          </section>
        )}

        <section className="panel-section">
          <PatternPicker layout={layout} onChange={setLayout} />
          <OrientationPicker tile={tile} layout={layout} onChange={setLayout} />
          <p className="muted">Trocar o encaixe ou a direção refaz a montagem; dá para voltar com Desfazer.</p>
        </section>

        <footer className="panel-footer">
          <div className="row">
            <button className="btn" onClick={() => setStep(3)}>
              Mudar o piso
            </button>
            <button className="btn btn-primary" disabled={!result || printing} onClick={() => void printSheet()}>
              {printing ? 'Preparando…' : 'Imprimir para a obra'}
            </button>
          </div>
        </footer>
      </aside>

      {result && <PrintSheet result={result} rooms={rooms} tile={tile} layout={layout} topView={topView} />}
    </div>
  );
}
