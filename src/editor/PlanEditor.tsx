import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { bbox } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';
import { useProject } from '../store/project';
import { isDrawn } from '../types';
import { fmt } from '../ui/format';
import { usePanZoom, type View } from '../ui/usePanZoom';
import { placeBeside, pointAtDistance, rectRing, snapAngle, snapMove, snapToGrid, translateRing } from './drawing';
import { useEditor, type Tool } from './editorStore';
import { calibrationScale, insertVertex, nearestEdge, removeVertex, roomSizeLabel } from './ops';

type Drag =
  | { kind: 'pan'; start: Point; view: View }
  | { kind: 'vertex'; roomId: string; index: number; moved: boolean }
  | { kind: 'move'; roomId: string; start: Point; screen: Point; base: Ring; moved: boolean }
  | null;

const CLOSE_PX = 12;
/** Espessura de parede usada para encaixar cômodos vizinhos. */
const WALL_GAP_CM = 15;
/** Grade de encaixe no projeto desenhado. */
const GRID_CM = 5;

const TOOL_LIST: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Selecionar', key: 'V' },
  { id: 'draw', label: 'Desenhar paredes', key: 'N' },
  { id: 'rect', label: 'Cômodo retangular', key: 'R' },
  { id: 'calibrate', label: 'Calibrar', key: 'C' },
];

const HINTS: Record<Tool, string> = {
  select:
    'Clique num cômodo para selecionar e arraste para mudar de lugar (ele encaixa nas paredes vizinhas). Arraste os pontos para ajustar, duplo clique na borda cria um ponto e Delete apaga o ponto selecionado.',
  draw: 'Clique onde a parede começa. Aponte a direção, digite o comprimento em cm (ex.: 320) e aperte Enter, ou clique. Ângulo reto é automático (Shift libera). Feche no primeiro ponto ou com Enter; Backspace desfaz o último ponto.',
  rect: 'Informe a largura e o comprimento: o cômodo aparece ao lado dos outros. Depois arraste para encaixar.',
  calibrate: 'Clique nas duas pontas de uma medida conhecida (por exemplo, uma parede cotada) e informe a distância real.',
};

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

const parseCm = (s: string) => Number(s.replace(',', '.'));

export default function PlanEditor() {
  const project = useProject((s) => s.project);
  const planUrl = useProject((s) => s.planUrl);
  const selectedRoomId = useProject((s) => s.selectedRoomId);
  const { selectRoom, updateRoom, addRoom, setScale } = useProject.getState();
  const { tool, setTool, fitToken, requestFit } = useEditor();
  const highlight = useEditor((s) => s.highlight);
  const plan = project.plan!;
  const drawn = isDrawn(project);
  const pxPerCm = project.scale?.pxPerCm ?? null;
  const tools = TOOL_LIST.filter((t) => !(drawn && t.id === 'calibrate'));

  const wrapRef = useRef<HTMLDivElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  // com cômodos, enquadra só eles (a planta pode ser pequena no meio de uma folha cheia de logotipos)
  const hasRooms = project.rooms.length > 0;
  const focus = useMemo(() => {
    if (!hasRooms) return undefined;
    const b = bbox(project.rooms.map((r) => r.polygonPx));
    const m = 0.08 * Math.max(b.w, b.h) + (drawn ? 60 : 0);
    return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m };
    // só reenquadra quando aparecem ou somem cômodos, não a cada vértice arrastado
  }, [hasRooms, plan.imageId, fitToken]);
  const { view, setView, toWorld, toScreen, fit } = usePanZoom(wrapRef, plan.widthPx, plan.heightPx, fitToken, focus);

  const [drag, setDrag] = useState<Drag>(null);
  const [draft, setDraft] = useState<{ roomId: string; ring: Ring } | null>(null);
  const [selVertex, setSelVertex] = useState<{ roomId: string; index: number } | null>(null);
  const [drawPts, setDrawPts] = useState<Point[]>([]);
  const [typed, setTyped] = useState('');
  const [calib, setCalib] = useState<Point[]>([]);
  const [calibCm, setCalibCm] = useState('');
  const [hover, setHover] = useState<Point | null>(null);
  const [rect, setRect] = useState({ name: '', w: '', h: '' });

  const k = view.k;
  const ringOf = (id: string) => (draft?.roomId === id ? draft.ring : project.rooms.find((r) => r.id === id)?.polygonPx);
  const lenLabel = (px: number) => (pxPerCm ? `${fmt(px / pxPerCm / 100, 2)} m` : '');

  // trocar de ferramenta limpa o que estava em andamento
  useEffect(() => {
    setDrawPts([]);
    setTyped('');
    setCalib([]);
    setCalibCm('');
    setSelVertex(null);
  }, [tool]);

  // o campo de medida fica em foco enquanto se desenha (funciona também com teclado de celular)
  useEffect(() => {
    if (tool === 'draw' && drawPts.length > 0) lengthRef.current?.focus();
  }, [tool, drawPts.length]);

  /** Ponto do desenho: grade no primeiro clique, ângulo reto e cm inteiros nos seguintes. */
  const drawPoint = (raw: Point, free: boolean): Point => {
    if (drawPts.length === 0) return drawn ? snapToGrid(raw, GRID_CM) : raw;
    const last = drawPts[drawPts.length - 1];
    const p = snapAngle(last, raw, !free);
    if (!pxPerCm) return p;
    const cm = Math.round(Math.hypot(p.x - last.x, p.y - last.y) / pxPerCm);
    return pointAtDistance(last, p, cm * pxPerCm);
  };

  const finishDrawing = (pts: Point[]) => {
    if (pts.length < 3) return;
    addRoom({ id: crypto.randomUUID(), name: '', polygonPx: pts, receivesTile: true, issues: [] });
    setDrawPts([]);
    setTyped('');
    setTool('select');
  };

  /** Parede com o comprimento digitado, na direção para onde o mouse aponta. */
  const placeTyped = () => {
    const cm = parseCm(typed);
    if (!(cm > 0) || !pxPerCm || drawPts.length === 0) return;
    const last = drawPts[drawPts.length - 1];
    const toward = hover ?? { x: last.x + 1, y: last.y };
    setDrawPts([...drawPts, pointAtDistance(last, toward, cm * pxPerCm)]);
    setTyped('');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === 'Escape') {
        setDrawPts([]);
        setTyped('');
        setCalib([]);
        setSelVertex(null);
      } else if (e.key === 'Enter' && tool === 'draw') {
        if (typed) placeTyped();
        else finishDrawing(drawPts);
      } else if (e.key === 'Backspace' && tool === 'draw' && (typed || drawPts.length > 0)) {
        e.preventDefault();
        if (typed) setTyped(typed.slice(0, -1));
        else setDrawPts(drawPts.slice(0, -1));
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selVertex) {
        const ring = ringOf(selVertex.roomId);
        if (ring) updateRoom(selVertex.roomId, { polygonPx: removeVertex(ring, selVertex.index) });
        setSelVertex(null);
      } else if (!e.ctrlKey && !e.metaKey) {
        const t = tools.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
        if (t) setTool(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toWorld(e.clientX, e.clientY);
    const target = e.target as Element;
    const startPan = () => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, view });
    };

    if (e.button === 1 || e.button === 2) return startPan();

    if (tool === 'draw') {
      if (drawPts.length >= 3) {
        const first = toScreen(drawPts[0]);
        const here = toScreen(p);
        if (Math.hypot(first.x - here.x, first.y - here.y) < CLOSE_PX) return finishDrawing(drawPts);
      }
      setDrawPts([...drawPts, drawPoint(p, e.shiftKey)]);
      setTyped('');
      return;
    }

    if (tool === 'calibrate') {
      setCalib(calib.length >= 2 ? [p] : [...calib, p]);
      return;
    }

    if (tool === 'rect') return startPan();

    const vertex = target.closest('[data-vertex]');
    if (vertex) {
      const roomId = vertex.getAttribute('data-room')!;
      const index = Number(vertex.getAttribute('data-vertex'));
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelVertex({ roomId, index });
      setDraft({ roomId, ring: ringOf(roomId)!.slice() });
      setDrag({ kind: 'vertex', roomId, index, moved: false });
      return;
    }
    const roomEl = target.closest('[data-room-shape]');
    if (roomEl) {
      const roomId = roomEl.getAttribute('data-room-shape')!;
      selectRoom(roomId);
      setSelVertex(null);
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ kind: 'move', roomId, start: p, screen: { x: e.clientX, y: e.clientY }, base: ringOf(roomId)!.slice(), moved: false });
      return;
    }
    selectRoom(null);
    setSelVertex(null);
    startPan();
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag?.kind === 'pan') {
      setView({ ...drag.view, tx: drag.view.tx + e.clientX - drag.start.x, ty: drag.view.ty + e.clientY - drag.start.y });
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    if (drag?.kind === 'vertex' && draft) {
      const ring = draft.ring.slice();
      ring[drag.index] = drawn ? snapToGrid(p, 1) : p;
      setDraft({ ...draft, ring });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag?.kind === 'move') {
      if (!drag.moved && Math.hypot(e.clientX - drag.screen.x, e.clientY - drag.screen.y) < 4) return;
      const others = project.rooms.filter((r) => r.id !== drag.roomId).map((r) => r.polygonPx);
      const raw = { x: p.x - drag.start.x, y: p.y - drag.start.y };
      const d = snapMove(drag.base, others, drawn ? snapToGrid(raw, 1) : raw, WALL_GAP_CM * (pxPerCm ?? 1), 10 / k);
      setDraft({ roomId: drag.roomId, ring: translateRing(drag.base, d.x, d.y) });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (tool === 'draw') setHover(drawPoint(p, e.shiftKey));
    else if (tool !== 'select') setHover(p);
  };

  const onPointerUp = () => {
    if ((drag?.kind === 'vertex' || drag?.kind === 'move') && draft && drag.moved) {
      updateRoom(draft.roomId, { polygonPx: draft.ring });
    }
    setDraft(null);
    setDrag(null);
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== 'select' || !selectedRoomId) return;
    const ring = ringOf(selectedRoomId);
    if (!ring) return;
    const p = toWorld(e.clientX, e.clientY);
    const edge = nearestEdge(ring, p);
    if (edge.dist * k < 10) {
      updateRoom(selectedRoomId, { polygonPx: insertVertex(ring, edge.index, edge.foot) });
      setSelVertex({ roomId: selectedRoomId, index: edge.index + 1 });
    }
  };

  const applyCalibration = () => {
    const cm = parseCm(calibCm);
    if (!(cm > 0) || calib.length < 2) return;
    setScale({ pxPerCm: calibrationScale(calib[0], calib[1], cm), source: 'manual', confidence: 1 });
    setCalib([]);
    setCalibCm('');
    setTool('select');
  };

  const addRect = () => {
    const w = parseCm(rect.w);
    const h = parseCm(rect.h);
    if (!(w > 0) || !(h > 0) || !pxPerCm) return;
    const rings = project.rooms.map((r) => r.polygonPx);
    let at = placeBeside(rings, WALL_GAP_CM * pxPerCm);
    if (rings.length === 0) {
      if (drawn) at = { x: 100, y: 100 };
      else {
        const el = wrapRef.current!.getBoundingClientRect();
        const c = toWorld(el.left + el.width / 2, el.top + el.height / 2);
        at = { x: c.x - (w * pxPerCm) / 2, y: c.y - (h * pxPerCm) / 2 };
      }
    }
    const id = crypto.randomUUID();
    addRoom({ id, name: rect.name.trim(), polygonPx: rectRing(at.x, at.y, w * pxPerCm, h * pxPerCm), receivesTile: true, issues: [] });
    setRect({ name: '', w: '', h: '' });
    setTool('select');
    requestFit();
  };

  const pts = (ring: Ring) => ring.map((q) => `${q.x},${q.y}`).join(' ');
  const calibEnd = calib.length === 1 ? hover : calib[1];
  const calibMid = calib.length === 2 ? toScreen({ x: (calib[0].x + calib[1].x) / 2, y: (calib[0].y + calib[1].y) / 2 }) : null;
  const calibPx = calib.length === 2 ? Math.hypot(calib[1].x - calib[0].x, calib[1].y - calib[0].y) : 0;
  const lastPt = drawPts[drawPts.length - 1];
  const liveLen = tool === 'draw' && lastPt && hover ? Math.hypot(hover.x - lastPt.x, hover.y - lastPt.y) : 0;
  const badgeAt = tool === 'draw' && hover && lastPt ? toScreen(hover) : null;
  const hlRing = highlight ? ringOf(highlight.roomId) : undefined;
  const gridArea = useMemo(() => {
    const b = hasRooms ? bbox(project.rooms.map((r) => r.polygonPx)) : { x: 0, y: 0, w: plan.widthPx, h: plan.heightPx };
    return { x: Math.min(0, b.x) - 2000, y: Math.min(0, b.y) - 2000, w: Math.max(plan.widthPx, b.x + b.w) + 4000, h: Math.max(plan.heightPx, b.y + b.h) + 4000 };
  }, [hasRooms, project.rooms, plan.widthPx, plan.heightPx]);

  return (
    <div className="canvas" ref={wrapRef}>
      <div className="toolbar" role="toolbar" aria-label="Ferramentas">
        {tools.map((t) => (
          <button key={t.id} className="tool" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
            {t.label}
          </button>
        ))}
        <button className="tool" onClick={fit} title="Enquadrar a planta">
          Enquadrar
        </button>
      </div>

      <svg
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: tool === 'select' ? (drag?.kind === 'pan' ? 'grabbing' : drag?.kind === 'move' ? 'move' : 'default') : 'crosshair' }}
      >
        {drawn && (
          <defs>
            <pattern id="grade-10" width={10} height={10} patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e3e6e3" strokeWidth={1 / k} />
            </pattern>
            <pattern id="grade-100" width={100} height={100} patternUnits="userSpaceOnUse">
              {10 * k >= 6 && <rect width={100} height={100} fill="url(#grade-10)" />}
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#c9cdc9" strokeWidth={1.2 / k} />
            </pattern>
          </defs>
        )}
        <g transform={`translate(${view.tx},${view.ty}) scale(${k})`}>
          {drawn ? (
            <rect x={gridArea.x} y={gridArea.y} width={gridArea.w} height={gridArea.h} fill="url(#grade-100)" />
          ) : (
            planUrl && <image href={planUrl} width={plan.widthPx} height={plan.heightPx} />
          )}

          {project.rooms.map((room, i) => {
            const ring = ringOf(room.id)!;
            const selected = room.id === selectedRoomId;
            const b = bbox(ring);
            const warn = room.issues.length > 0;
            return (
              <g key={room.id}>
                <polygon
                  data-room-shape={room.id}
                  points={pts(ring)}
                  fill={selected ? 'rgba(242,194,48,0.28)' : room.receivesTile ? 'rgba(79,134,198,0.18)' : 'rgba(95,102,108,0.12)'}
                  stroke={selected ? '#b88a06' : warn ? '#d9493b' : '#2f5f99'}
                  strokeWidth={selected ? 2.5 : drawn ? 3 : 1.5}
                  strokeDasharray={room.receivesTile ? undefined : '6 4'}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: tool === 'select' ? 'move' : undefined }}
                />
                <text
                  x={b.x + b.w / 2}
                  y={b.y + b.h / 2}
                  textAnchor="middle"
                  fontSize={14 / k}
                  fontWeight={650}
                  fill="#22262a"
                  stroke="#fff"
                  strokeWidth={3 / k}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {room.name || `Cômodo ${i + 1}`}
                  {project.scale && (
                    <tspan x={b.x + b.w / 2} dy={17 / k} fontSize={12 / k} fontWeight={450}>
                      {roomSizeLabel(ring, project.scale.pxPerCm)}
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}

          {hlRing && highlight && (
            <line
              x1={hlRing[highlight.index].x}
              y1={hlRing[highlight.index].y}
              x2={hlRing[(highlight.index + 1) % hlRing.length].x}
              y2={hlRing[(highlight.index + 1) % hlRing.length].y}
              stroke="#f2c230"
              strokeWidth={6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}

          {selectedRoomId &&
            tool === 'select' &&
            ringOf(selectedRoomId)?.map((q, i) => {
              const active = selVertex?.roomId === selectedRoomId && selVertex.index === i;
              return (
                <circle
                  key={i}
                  data-vertex={i}
                  data-room={selectedRoomId}
                  cx={q.x}
                  cy={q.y}
                  r={(active ? 7 : 5.5) / k}
                  fill={active ? '#f2c230' : '#fff'}
                  stroke="#22262a"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'crosshair' }}
                />
              );
            })}

          {tool === 'draw' && drawPts.length > 0 && (
            <g pointerEvents="none">
              <polyline
                points={pts(hover ? [...drawPts, hover] : drawPts)}
                fill="rgba(242,194,48,0.15)"
                stroke="#22262a"
                strokeWidth={drawn ? 3 : 2}
                vectorEffect="non-scaling-stroke"
              />
              {drawPts.map((q, i) => (
                <circle key={i} cx={q.x} cy={q.y} r={(i === 0 ? 7 : 4) / k} fill={i === 0 ? '#f2c230' : '#22262a'} />
              ))}
              {pxPerCm &&
                drawPts.slice(1).map((q, i) => {
                  const a = drawPts[i];
                  return (
                    <text
                      key={`l${i}`}
                      x={(a.x + q.x) / 2}
                      y={(a.y + q.y) / 2 - 6 / k}
                      textAnchor="middle"
                      fontSize={12 / k}
                      fontWeight={600}
                      fill="#22262a"
                      stroke="#fff"
                      strokeWidth={3 / k}
                      paintOrder="stroke"
                    >
                      {lenLabel(Math.hypot(q.x - a.x, q.y - a.y))}
                    </text>
                  );
                })}
            </g>
          )}

          {tool === 'calibrate' && calib.length > 0 && (
            <g pointerEvents="none">
              {calibEnd && (
                <line
                  x1={calib[0].x}
                  y1={calib[0].y}
                  x2={calibEnd.x}
                  y2={calibEnd.y}
                  stroke="#d9493b"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {calib.map((q, i) => (
                <circle key={i} cx={q.x} cy={q.y} r={5 / k} fill="#d9493b" />
              ))}
            </g>
          )}
        </g>
      </svg>

      {tool === 'draw' && drawPts.length > 0 && pxPerCm && (
        <form
          className="popover length-field"
          style={{ left: 12, top: 60 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (typed) placeTyped();
            else finishDrawing(drawPts);
          }}
        >
          <label className="field">
            <span>Próxima parede (cm)</span>
            <input
              ref={lengthRef}
              className="input"
              inputMode="decimal"
              value={typed}
              placeholder="ex.: 320"
              onChange={(e) => setTyped(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 7))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDrawPts([]);
                  setTyped('');
                } else if (e.key === 'Backspace' && !typed) {
                  e.preventDefault();
                  setDrawPts(drawPts.slice(0, -1));
                }
              }}
            />
          </label>
          <p className="muted">
            Aponte a direção com o mouse e aperte Enter. {drawPts.length >= 3 ? 'Enter com o campo vazio fecha o cômodo.' : ''}
          </p>
        </form>
      )}

      {badgeAt && (pxPerCm || typed) && (
        <div className={`measure-badge${typed ? ' typing' : ''}`} style={{ left: badgeAt.x, top: badgeAt.y }}>
          {typed ? `${typed} cm, Enter para confirmar` : lenLabel(liveLen)}
        </div>
      )}

      {tool === 'rect' && (
        <form
          className="popover"
          style={{ left: 12, top: 60 }}
          onSubmit={(e) => {
            e.preventDefault();
            addRect();
          }}
        >
          {pxPerCm ? (
            <>
              <label className="field">
                <span>Nome</span>
                <input className="input" autoFocus value={rect.name} onChange={(e) => setRect({ ...rect, name: e.target.value })} placeholder="ex.: Quarto" />
              </label>
              <div className="row-2">
                <label className="field">
                  <span>Largura (cm)</span>
                  <input className="input" inputMode="decimal" value={rect.w} onChange={(e) => setRect({ ...rect, w: e.target.value })} placeholder="320" />
                </label>
                <label className="field">
                  <span>Comprimento (cm)</span>
                  <input className="input" inputMode="decimal" value={rect.h} onChange={(e) => setRect({ ...rect, h: e.target.value })} placeholder="280" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" type="submit" disabled={!(parseCm(rect.w) > 0 && parseCm(rect.h) > 0)}>
                  Adicionar cômodo
                </button>
                <button className="btn btn-sm" type="button" onClick={() => setTool('select')}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Calibre a escala primeiro, para o app saber o tamanho real.</p>
          )}
        </form>
      )}

      {calibMid && (
        <form
          className="popover"
          style={{ left: Math.max(8, calibMid.x - 120), top: calibMid.y + 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            applyCalibration();
          }}
        >
          <label className="field">
            <span>Distância real (cm)</span>
            <input
              className="input"
              autoFocus
              inputMode="decimal"
              value={calibCm}
              onChange={(e) => setCalibCm(e.target.value)}
              placeholder="ex.: 320"
            />
          </label>
          <p className="muted">Linha marcada: {Math.round(calibPx)} px</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!(parseCm(calibCm) > 0)}>
              Aplicar escala
            </button>
            <button className="btn btn-sm" type="button" onClick={() => setCalib([])}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <p className="hint">{HINTS[tool]}</p>
    </div>
  );
}
