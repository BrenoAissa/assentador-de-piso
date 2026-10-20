import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { bbox } from '../geometry/polygon';
import type { Point, Ring } from '../geometry/types';
import { useProject } from '../store/project';
import { isDrawn } from '../types';
import { fmt } from '../ui/format';
import { usePanZoom, type View } from '../ui/usePanZoom';
import { placeBeside, pointAtDistance, rectRing, snapAngle, snapMove, snapToGeometry, snapToGrid, translateRing, type GeoSnap } from './drawing';
import { useEditor, type Tool } from './editorStore';
import { calibrationScale, insertVertex, nearestEdge, removeVertex, roomSizeLabel } from './ops';
import { FitButton, MagnetButton } from '../ui/CanvasButtons';
import Hint, { isTouch } from '../ui/Hint';

type Drag =
  /** `tap`: no desenho e na calibragem, soltar sem arrastar põe o ponto; arrastar move a vista. */
  | { kind: 'pan'; start: Point; view: View; tap?: boolean; moved?: boolean }
  | { kind: 'vertex'; roomId: string; index: number; moved: boolean }
  | { kind: 'move'; roomId: string; start: Point; screen: Point; base: Ring; moved: boolean }
  | null;

const CLOSE_PX = 12;
/** Até quantos px de tela o dedo (ou o mouse) pode escorregar e ainda contar como toque. */
const TAP_PX = 8;
/** Espessura de parede usada para encaixar cômodos vizinhos. */
const WALL_GAP_CM = 15;
/** Grade de encaixe no projeto desenhado. */
const GRID_CM = 5;

/** `short`: nome no celular, onde a barra precisa caber na largura da tela. */
const TOOL_LIST: { id: Tool; label: string; short: string; key: string }[] = [
  { id: 'select', label: 'Selecionar', short: 'Selecionar', key: 'V' },
  { id: 'draw', label: 'Desenhar paredes', short: 'Paredes', key: 'N' },
  { id: 'rect', label: 'Cômodo retangular', short: 'Retângulo', key: 'R' },
  { id: 'calibrate', label: 'Calibrar', short: 'Calibrar', key: 'C' },
];

const HINTS: Record<Tool, string> = {
  select:
    'Clique num cômodo para selecionar e arraste para mudar de lugar (ele encaixa nas paredes vizinhas). Arraste os pontos para ajustar (Shift: livre, sem ímã), duplo clique na borda cria um ponto e Delete apaga o ponto selecionado.',
  draw: 'Clique onde a parede começa. Digite o comprimento em cm e use as setas (na tela ou no teclado), ou aponte com o mouse e aperte Enter. Ângulo reto e encaixes são automáticos; segure Shift para desenhar livre. Feche no primeiro ponto ou em Fechar cômodo.',
  rect: 'Informe a largura e o comprimento: o cômodo aparece ao lado dos outros. Depois arraste para encaixar.',
  calibrate: 'Clique nas duas pontas de uma medida conhecida (por exemplo, uma parede cotada) e informe a distância real.',
};

/** No celular as dicas falam em toque, e mover um cômodo pede selecioná-lo antes. */
const TOUCH_HINTS: Partial<Record<Tool, string>> = {
  select:
    'Toque num cômodo para selecionar. Com ele selecionado, arraste para mudar de lugar ou arraste os pontos para ajustar. Arraste o fundo para mover a vista e use dois dedos para aproximar.',
  draw: 'Toque para pôr um ponto; arraste com um dedo para mover a planta e use dois dedos para aproximar. Ou toque no campo, digite a medida e use as setas. Feche no primeiro ponto ou em Fechar cômodo.',
  calibrate: 'Toque nas duas pontas de uma medida conhecida (por exemplo, uma parede cotada) e informe a distância real.',
};

/** Setas do desenho por medida, no referencial da planta (y cresce para baixo). */
const DIRS: { key: string; label: string; name: string; d: Point }[] = [
  { key: 'ArrowLeft', label: '←', name: 'para a esquerda', d: { x: -1, y: 0 } },
  { key: 'ArrowUp', label: '↑', name: 'para cima', d: { x: 0, y: -1 } },
  { key: 'ArrowDown', label: '↓', name: 'para baixo', d: { x: 0, y: 1 } },
  { key: 'ArrowRight', label: '→', name: 'para a direita', d: { x: 1, y: 0 } },
];

/** Botões do painel de desenho não tiram o foco do campo de medida (o teclado do celular fica aberto). */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

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
  const magnet = useEditor((s) => s.magnet);
  const setMagnet = useEditor((s) => s.setMagnet);
  /** Sem ímã: Shift segurado ou botão Ímã desligado. */
  const isFree = (e: { shiftKey: boolean }) => e.shiftKey || !magnet;
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
  /** Nome do cômodo que está sendo desenhado parede por parede (opcional). */
  const [drawName, setDrawName] = useState('');
  const [calib, setCalib] = useState<Point[]>([]);
  const [calibCm, setCalibCm] = useState('');
  const [hover, setHover] = useState<Point | null>(null);
  /** Resultado do ímã no ponto atual (conectado, encostado, alinhado) e as guias. */
  const [snapInfo, setSnapInfo] = useState<Pick<GeoSnap, 'kind' | 'guides'>>({ kind: null, guides: [] });
  const [rect, setRect] = useState({ name: '', w: '', h: '' });

  const k = view.k;
  const touch = useMemo(isTouch, []);
  const ringOf = (id: string) => (draft?.roomId === id ? draft.ring : project.rooms.find((r) => r.id === id)?.polygonPx);
  const lenLabel = (px: number) => (pxPerCm ? `${fmt(px / pxPerCm / 100, 2)} m` : '');

  // trocar de ferramenta limpa o que estava em andamento
  useEffect(() => {
    setDrawPts([]);
    setTyped('');
    setDrawName('');
    setCalib([]);
    setCalibCm('');
    setSelVertex(null);
  }, [tool]);

  // no computador, o campo de medida fica em foco enquanto se desenha; no celular, focar sozinho
  // abriria o teclado (e no iPhone rolaria a tela) a cada ponto: lá a pessoa toca no campo quando quer
  useEffect(() => {
    if (!touch && tool === 'draw' && drawPts.length > 0) lengthRef.current?.focus();
  }, [tool, drawPts.length]);

  const tolW = 10 / view.k;
  const otherRings = (exceptId?: string) => project.rooms.filter((r) => r.id !== exceptId).map((r) => r.polygonPx);

  /**
   * Ponto do desenho. Ordem do ímã: conectar num canto (outros cômodos ou o próprio desenho),
   * ângulo reto, encostar/alinhar com paredes e cantos; sem ímã, cm inteiros (e grade no 1º ponto).
   * Livre (Shift ou Ímã desligado): nada puxa, só os cm inteiros na planta desenhada.
   */
  const drawPoint = (raw: Point, free: boolean): GeoSnap => {
    if (free) return { point: drawn ? snapToGrid(raw, 1) : raw, kind: null, guides: [] };
    const rings = otherRings();
    if (drawPts.length === 0) {
      const s0 = snapToGeometry(raw, rings, [], tolW);
      return s0.kind ? s0 : { point: drawn ? snapToGrid(raw, GRID_CM) : raw, kind: null, guides: [] };
    }
    const last = drawPts[drawPts.length - 1];
    const own = drawPts.slice(0, -1);
    const v = snapToGeometry(raw, rings, own, tolW);
    if (v.kind === 'vertex') return v;
    let p = snapAngle(last, raw, !free);
    const lock = p.y === last.y && p.x !== last.x ? 'x' : p.x === last.x && p.y !== last.y ? 'y' : undefined;
    const a = snapToGeometry(p, rings, own, tolW, lock);
    if (a.kind) return a;
    if (pxPerCm) {
      const cm = Math.round(Math.hypot(p.x - last.x, p.y - last.y) / pxPerCm);
      p = pointAtDistance(last, p, cm * pxPerCm);
    }
    return { point: p, kind: null, guides: [] };
  };

  const finishDrawing = (pts: Point[]) => {
    if (pts.length < 3) return;
    addRoom({ id: crypto.randomUUID(), name: drawName.trim(), polygonPx: pts, receivesTile: true, issues: [] });
    setDrawPts([]);
    setTyped('');
    setDrawName('');
    setTool('select');
    requestFit();
  };

  /**
   * Traz o ponto para a vista (fora do painel de medida) quando ele nasce das setas ou do
   * "Começar ao lado". Um ponto tocado já está à vista: mexer na vista ali brigaria com o dedo.
   */
  const reveal = (pt: Point) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panel = el.querySelector<HTMLElement>('.draw-panel');
    const top = panel && panel.offsetWidth > r.width * 0.6 ? panel.offsetTop + panel.offsetHeight : 0;
    const p = toScreen(pt);
    const m = 48;
    if (p.x < m || p.x > r.width - m || p.y < top + m || p.y > r.height - m) {
      setView((v) => ({ ...v, tx: v.tx + r.width / 2 - p.x, ty: v.ty + (top + r.height) / 2 - p.y }));
    }
  };

  /** Ponto tocado (ou clicado) no desenho; perto do primeiro ponto, fecha o cômodo. */
  const placeDrawPoint = (p: Point, free: boolean) => {
    if (drawPts.length >= 3) {
      const first = toScreen(drawPts[0]);
      const here = toScreen(p);
      if (Math.hypot(first.x - here.x, first.y - here.y) < CLOSE_PX * (touch ? 2 : 1)) return finishDrawing(drawPts);
    }
    const sp = drawPoint(p, free).point;
    const first = drawPts[0];
    if (first && drawPts.length >= 3 && Math.hypot(sp.x - first.x, sp.y - first.y) < 0.01) return finishDrawing(drawPts);
    setDrawPts([...drawPts, sp]);
    setTyped('');
  };

  /** Parede com o comprimento digitado, na direção para onde o mouse aponta (sem mouse, use as setas). */
  const placeTyped = () => {
    const cm = parseCm(typed);
    if (!(cm > 0) || !pxPerCm || drawPts.length === 0 || !hover) return;
    const last = drawPts[drawPts.length - 1];
    setDrawPts([...drawPts, pointAtDistance(last, hover, cm * pxPerCm)]);
    setTyped('');
  };

  /** Parede com o comprimento digitado na direção da seta; voltando ao primeiro ponto, fecha o cômodo. */
  const addWall = (d: Point) => {
    const cm = parseCm(typed);
    if (!(cm > 0) || !pxPerCm || drawPts.length === 0) return;
    const last = drawPts[drawPts.length - 1];
    const next = { x: last.x + d.x * cm * pxPerCm, y: last.y + d.y * cm * pxPerCm };
    const first = drawPts[0];
    if (drawPts.length >= 3 && Math.hypot(next.x - first.x, next.y - first.y) < 0.5 * pxPerCm) return finishDrawing(drawPts);
    setDrawPts([...drawPts, next]);
    setTyped('');
    reveal(next);
  };

  /** Primeiro ponto sem tocar na planta: ao lado dos cômodos que já existem, ou no canto da folha. */
  const startBeside = () => {
    const rings = otherRings();
    const at = rings.length ? placeBeside(rings, WALL_GAP_CM * (pxPerCm ?? 1)) : { x: 100, y: 100 };
    setDrawPts([at]);
    reveal(at);
  };

  const undoPoint = () => {
    setDrawPts(drawPts.slice(0, -1));
    setTyped('');
  };

  const deleteVertex = () => {
    if (!selVertex) return;
    const ring = ringOf(selVertex.roomId);
    if (ring && ring.length > 3) updateRoom(selVertex.roomId, { polygonPx: removeVertex(ring, selVertex.index) });
    setSelVertex(null);
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
        deleteVertex();
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

    // desenho e calibragem: o ponto só nasce ao soltar sem arrastar (onPointerUp); arrastar move a vista
    if (tool === 'draw' || tool === 'calibrate') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, view, tap: true });
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
      // no toque, o primeiro toque só seleciona: arrastar antes disso move a vista, não o cômodo
      if (e.pointerType === 'touch' && roomId !== selectedRoomId) {
        selectRoom(roomId);
        setSelVertex(null);
        return startPan();
      }
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
      const dx = e.clientX - drag.start.x;
      const dy = e.clientY - drag.start.y;
      if (drag.tap && !drag.moved) {
        if (Math.hypot(dx, dy) < TAP_PX) return;
        setDrag({ ...drag, moved: true });
      }
      setView({ ...drag.view, tx: drag.view.tx + dx, ty: drag.view.ty + dy });
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    if (drag?.kind === 'vertex' && draft) {
      const ring = draft.ring.slice();
      const sameRoom = draft.ring.filter((_, j) => j !== drag.index);
      const sv = isFree(e) ? null : snapToGeometry(p, otherRings(drag.roomId), sameRoom, tolW);
      ring[drag.index] = sv?.kind ? sv.point : drawn ? snapToGrid(p, 1) : p;
      setSnapInfo({ kind: sv?.kind ?? null, guides: sv?.guides ?? [] });
      setDraft({ ...draft, ring });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag?.kind === 'move') {
      if (!drag.moved && Math.hypot(e.clientX - drag.screen.x, e.clientY - drag.screen.y) < 4) return;
      const others = project.rooms.filter((r) => r.id !== drag.roomId).map((r) => r.polygonPx);
      const raw = { x: p.x - drag.start.x, y: p.y - drag.start.y };
      const step = drawn ? snapToGrid(raw, 1) : raw;
      const d = isFree(e) ? step : snapMove(drag.base, others, step, WALL_GAP_CM * (pxPerCm ?? 1), 10 / k);
      setDraft({ roomId: drag.roomId, ring: translateRing(drag.base, d.x, d.y) });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (tool === 'draw') {
      const sp = drawPoint(p, isFree(e));
      setHover(sp.point);
      setSnapInfo({ kind: sp.kind, guides: sp.guides });
    } else if (tool !== 'select') setHover(p);
  };

  /** Gesto interrompido (virou pinça com dois dedos): nada é criado nem salvo. */
  const onPointerCancel = () => {
    setSnapInfo({ kind: null, guides: [] });
    setDraft(null);
    setDrag(null);
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag?.kind === 'pan' && drag.tap && !drag.moved) {
      const p = toWorld(e.clientX, e.clientY);
      if (tool === 'draw') placeDrawPoint(p, isFree(e));
      else if (tool === 'calibrate') setCalib(calib.length >= 2 ? [p] : [...calib, p]);
    }
    setSnapInfo({ kind: null, guides: [] });
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
            <span className="long">{t.label}</span>
            <span className="short">{t.short}</span>
          </button>
        ))}
        <FitButton onClick={fit} />
        <MagnetButton on={magnet} onClick={() => setMagnet(!magnet)} />
      </div>

      <svg
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => {
          setHover(null);
          setSnapInfo({ kind: null, guides: [] });
        }}
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
            // sem nome é pendência da lista, não erro de contorno: a borda vermelha fica para os erros
            const warn = room.issues.some((i) => i !== 'unnamed');
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
                <g key={i}>
                  {/* área de toque maior que o ponto desenhado */}
                  <circle data-vertex={i} data-room={selectedRoomId} cx={q.x} cy={q.y} r={(touch ? 22 : 10) / k} fill="transparent" style={{ cursor: 'crosshair' }} />
                  <circle
                    data-vertex={i}
                    data-room={selectedRoomId}
                    cx={q.x}
                    cy={q.y}
                    r={(active ? 8 : touch ? 7 : 5.5) / k}
                    fill={active ? '#f2c230' : '#fff'}
                    stroke="#22262a"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'crosshair' }}
                  />
                </g>
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

          {snapInfo.guides.map((g, i) => (
            <line
              key={`guia${i}`}
              x1={g.a.x}
              y1={g.a.y}
              x2={g.b.x}
              y2={g.b.y}
              stroke="#2f5f99"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          {snapInfo.kind && (tool === 'draw' ? hover : drag?.kind === 'vertex' && draft ? draft.ring[drag.index] : null) && (() => {
            const at = tool === 'draw' ? hover! : draft!.ring[(drag as { index: number }).index];
            return snapInfo.kind === 'vertex' ? (
              <circle cx={at.x} cy={at.y} r={10 / k} fill="none" stroke="#2f7d4f" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : snapInfo.kind === 'edge' ? (
              <rect x={at.x - 6 / k} y={at.y - 6 / k} width={12 / k} height={12 / k} fill="none" stroke="#2f7d4f" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : null;
          })()}

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

      {tool === 'draw' && pxPerCm && (
        <form
          className="popover draw-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed) placeTyped();
            else finishDrawing(drawPts);
          }}
        >
          {drawPts.length === 0 ? (
            <>
              <label className="field draw-name">
                <span>Nome do cômodo (opcional)</span>
                <input className="input" value={drawName} onChange={(e) => setDrawName(e.target.value)} placeholder="ex.: Sala" />
              </label>
              <p>
                <strong>Onde a parede começa?</strong> Toque na planta ou comece {hasRooms ? 'ao lado dos cômodos' : 'pelo canto da folha'}.
              </p>
              <button type="button" className="btn btn-sm" onClick={startBeside}>
                {hasRooms ? 'Começar ao lado dos cômodos' : 'Começar pelo canto'}
              </button>
            </>
          ) : (
            <>
              <div className="measure-row">
                <label className="field">
                  <span>Medida da próxima parede</span>
                  <span className="input-wrap">
                    <input
                      ref={lengthRef}
                      className="input"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={typed}
                      placeholder="ex.: 320"
                      onChange={(e) => setTyped(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 7))}
                      onKeyDown={(e) => {
                        const dir = DIRS.find((d) => d.key === e.key);
                        if (dir && typed) {
                          e.preventDefault();
                          addWall(dir.d);
                        } else if (e.key === 'Escape') {
                          setDrawPts([]);
                          setTyped('');
                        } else if (e.key === 'Backspace' && !typed) {
                          e.preventDefault();
                          undoPoint();
                        }
                      }}
                    />
                    <span className="suffix">cm</span>
                  </span>
                </label>
                <button type="button" className="btn undo-point" onPointerDown={keepFocus} onClick={undoPoint} aria-label="Desfazer o último ponto" title="Desfazer o último ponto">
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <path d="M7 5 3 9l4 4M3.5 9H12a5 5 0 0 1 0 10H9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="dir-pad" role="group" aria-label="Direção da parede">
                {DIRS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    className="btn dir"
                    disabled={!(parseCm(typed) > 0)}
                    aria-label={`Parede ${d.name}`}
                    onPointerDown={keepFocus}
                    onClick={() => addWall(d.d)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="muted draw-tip">{typed ? 'Toque na seta da direção da parede.' : 'Digite a medida e toque na seta da direção.'}</p>
              {drawPts.length >= 3 && (
                <button type="button" className="btn btn-sm btn-primary" onPointerDown={keepFocus} onClick={() => finishDrawing(drawPts)}>
                  Fechar cômodo
                </button>
              )}
            </>
          )}
        </form>
      )}

      {tool === 'select' && selVertex && selVertex.roomId === selectedRoomId && (ringOf(selVertex.roomId)?.length ?? 0) > 3 && (() => {
        const at = toScreen(ringOf(selVertex.roomId)![selVertex.index]);
        return (
          <button className="btn btn-sm vertex-delete" style={{ left: at.x + 14, top: at.y + 14 }} onClick={deleteVertex}>
            Apagar ponto
          </button>
        );
      })()}

      {drawn && !hasRooms && tool === 'select' && (
        <div className="empty-start">
          <h3>Comece pelo primeiro cômodo</h3>
          <button className="btn btn-primary btn-lg" onClick={() => setTool('rect')}>
            Cômodo retangular
            <small>largura × comprimento</small>
          </button>
          <button className="btn btn-lg" onClick={() => setTool('draw')}>
            Desenhar paredes
            <small>parede por parede, com a trena</small>
          </button>
        </div>
      )}

      {badgeAt && (pxPerCm || typed) && (
        <div className={`measure-badge${typed ? ' typing' : ''}`} style={{ left: badgeAt.x, top: badgeAt.y }}>
          {typed
            ? `${typed} cm, Enter para confirmar`
            : `${lenLabel(liveLen)}${snapInfo.kind === 'vertex' ? ', conectado' : snapInfo.kind === 'edge' ? ', na parede' : ''}`}
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
                  <input className="input" inputMode="decimal" value={rect.w} onChange={(e) => setRect({ ...rect, w: e.target.value })} placeholder="ex.: 320" />
                </label>
                <label className="field">
                  <span>Comprimento (cm)</span>
                  <input className="input" inputMode="decimal" value={rect.h} onChange={(e) => setRect({ ...rect, h: e.target.value })} placeholder="ex.: 280" />
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

      <Hint>{(touch && TOUCH_HINTS[tool]) || HINTS[tool]}</Hint>
    </div>
  );
}
