import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { bbox } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';
import { useProject } from '../store/project';
import { usePanZoom, type View } from '../ui/usePanZoom';
import { useEditor, type Tool } from './editorStore';
import { calibrationScale, insertVertex, nearestEdge, removeVertex, roomSizeLabel } from './ops';

type Drag =
  | { kind: 'pan'; start: Point; view: View }
  | { kind: 'vertex'; roomId: string; index: number; moved: boolean }
  | null;

const CLOSE_PX = 12;

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Selecionar', key: 'V' },
  { id: 'draw', label: 'Novo cômodo', key: 'N' },
  { id: 'calibrate', label: 'Calibrar', key: 'C' },
];

const HINTS: Record<Tool, string> = {
  select: 'Clique num cômodo para selecionar. Arraste os pontos para ajustar, dê duplo clique na borda para criar um ponto e use Delete para apagar o ponto selecionado.',
  draw: 'Clique em cada canto do cômodo. Clique no primeiro ponto ou aperte Enter para fechar. Esc cancela.',
  calibrate: 'Clique nas duas pontas de uma medida conhecida (por exemplo, uma parede cotada) e informe a distância real.',
};

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

export default function PlanEditor() {
  const project = useProject((s) => s.project);
  const planUrl = useProject((s) => s.planUrl);
  const selectedRoomId = useProject((s) => s.selectedRoomId);
  const { selectRoom, updateRoom, addRoom, setScale } = useProject.getState();
  const { tool, setTool, fitToken } = useEditor();
  const plan = project.plan!;

  const wrapRef = useRef<HTMLDivElement>(null);
  const { view, setView, toWorld, toScreen, fit } = usePanZoom(wrapRef, plan.widthPx, plan.heightPx, fitToken);

  const [drag, setDrag] = useState<Drag>(null);
  const [draft, setDraft] = useState<{ roomId: string; ring: Ring } | null>(null);
  const [selVertex, setSelVertex] = useState<{ roomId: string; index: number } | null>(null);
  const [drawPts, setDrawPts] = useState<Point[]>([]);
  const [calib, setCalib] = useState<Point[]>([]);
  const [calibCm, setCalibCm] = useState('');
  const [hover, setHover] = useState<Point | null>(null);

  const k = view.k;
  const ringOf = (id: string) => (draft?.roomId === id ? draft.ring : project.rooms.find((r) => r.id === id)?.polygonPx);

  // trocar de ferramenta limpa o que estava em andamento
  useEffect(() => {
    setDrawPts([]);
    setCalib([]);
    setCalibCm('');
    setSelVertex(null);
  }, [tool]);

  const finishDrawing = (pts: Point[]) => {
    if (pts.length < 3) return;
    addRoom({ id: crypto.randomUUID(), name: '', polygonPx: pts, receivesTile: true, issues: [] });
    setDrawPts([]);
    setTool('select');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === 'Escape') {
        setDrawPts([]);
        setCalib([]);
        setSelVertex(null);
      } else if (e.key === 'Enter' && tool === 'draw') {
        finishDrawing(drawPts);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selVertex) {
        const ring = ringOf(selVertex.roomId);
        if (ring) updateRoom(selVertex.roomId, { polygonPx: removeVertex(ring, selVertex.index) });
        setSelVertex(null);
      } else if (!e.ctrlKey && !e.metaKey) {
        const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
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
      setDrawPts([...drawPts, p]);
      return;
    }

    if (tool === 'calibrate') {
      setCalib(calib.length >= 2 ? [p] : [...calib, p]);
      return;
    }

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
      selectRoom(roomEl.getAttribute('data-room-shape'));
      setSelVertex(null);
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
      ring[drag.index] = p;
      setDraft({ ...draft, ring });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (tool !== 'select') setHover(p);
  };

  const onPointerUp = () => {
    if (drag?.kind === 'vertex' && draft && drag.moved) updateRoom(draft.roomId, { polygonPx: draft.ring });
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
    const cm = Number(calibCm.replace(',', '.'));
    if (!(cm > 0) || calib.length < 2) return;
    setScale({ pxPerCm: calibrationScale(calib[0], calib[1], cm), source: 'manual', confidence: 1 });
    setCalib([]);
    setCalibCm('');
    setTool('select');
  };

  const pts = (ring: Ring) => ring.map((q) => `${q.x},${q.y}`).join(' ');
  const calibEnd = calib.length === 1 ? hover : calib[1];
  const calibMid = calib.length === 2 ? toScreen({ x: (calib[0].x + calib[1].x) / 2, y: (calib[0].y + calib[1].y) / 2 }) : null;
  const calibPx = calib.length === 2 ? Math.hypot(calib[1].x - calib[0].x, calib[1].y - calib[0].y) : 0;

  return (
    <div className="canvas" ref={wrapRef}>
      <div className="toolbar" role="toolbar" aria-label="Ferramentas">
        {TOOLS.map((t) => (
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
        style={{ cursor: tool === 'select' ? (drag?.kind === 'pan' ? 'grabbing' : 'default') : 'crosshair' }}
      >
        <g transform={`translate(${view.tx},${view.ty}) scale(${k})`}>
          {planUrl && <image href={planUrl} width={plan.widthPx} height={plan.heightPx} />}

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
                  strokeWidth={selected ? 2.5 : 1.5}
                  strokeDasharray={room.receivesTile ? undefined : '6 4'}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: tool === 'select' ? 'pointer' : undefined }}
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
                  style={{ cursor: 'move' }}
                />
              );
            })}

          {tool === 'draw' && drawPts.length > 0 && (
            <g pointerEvents="none">
              <polyline
                points={pts(hover ? [...drawPts, hover] : drawPts)}
                fill="rgba(242,194,48,0.15)"
                stroke="#22262a"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              {drawPts.map((q, i) => (
                <circle key={i} cx={q.x} cy={q.y} r={(i === 0 ? 7 : 4) / k} fill={i === 0 ? '#f2c230' : '#22262a'} />
              ))}
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
            <button className="btn btn-primary btn-sm" type="submit" disabled={!(Number(calibCm.replace(',', '.')) > 0)}>
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
