import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useEditor } from '../editor/editorStore';
import { bbox, swapXY } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import { rowIsStrip, slotStart, targetIndex } from '../tiling/edits';
import { pitch } from '../tiling/grid';
import type { WallGuide } from '../tiling/snap';
import { entrancePiece, entrancePoints } from '../tiling/start';
import type { LayoutResult, LayoutSpec, Piece, RoomCm, TileSpec } from '../tiling/types';
import { usePanZoom, type View } from '../ui/usePanZoom';
import PlanSvg from './PlanSvg';
import { FitButton, MagnetButton } from '../ui/CanvasButtons';
import Hint from '../ui/Hint';

const MARGIN = 40;
const CLICK_PX = 4;
/** Distância (px de tela) em que o piso "gruda" na parede. */
const SNAP_PX = 10;

export type MontarTool = 'start' | 'floor' | 'row' | 'piece';

export const TOOL_HINT: Record<MontarTool, string> = {
  start: 'Toque na peça da entrada, por exemplo a da porta. Ela fica inteira, ganha a marca amarela e os recortes vão para as paredes do outro lado.',
  floor: 'Arraste o piso inteiro para mudar onde caem os recortes; ele gruda quando a peça encosta na parede (Shift: livre). Arraste o fundo para mover a vista.',
  row: 'Arraste uma peça para deslizar a fileira dela; ela gruda na parede e nas juntas das fileiras vizinhas (Shift: livre). Bom para levar o filete para baixo de um móvel.',
  piece: 'Arraste uma peça ao longo da fileira para trocar de lugar; ela pula de vaga em vaga e as outras se acomodam (Shift: livre). Clique numa peça para apagar ou marcar como embaixo de móvel.',
};

interface Props {
  result: LayoutResult;
  rooms: RoomCm[];
  tile: TileSpec;
  layout: LayoutSpec;
  tool: MontarTool;
  /** Planta original em cm, desenhada por cima das peças para mostrar os móveis. */
  furniture: { url: string; w: number; h: number } | null;
  selected: string | null;
  onSelect(key: string | null): void;
  onStart(p: Point): void;
  /**
   * Deslocamento em cm desde o início do arraste; `piece` é a peça onde o arraste começou;
   * `tolCm` é a distância em cm em que o ímã das paredes age, no zoom atual.
   */
  onFloorDrag(delta: Point, done: boolean, piece: Piece | undefined, tolCm: number): void;
  /** Deslocamento em cm ao longo da fileira. */
  onRowDrag(piece: Piece, delta: number, done: boolean, tolCm: number): void;
  /** Paredes onde as peças estão encostadas durante o arraste (acendem). */
  guides?: WallGuide[];
  /** Texto junto ao cursor durante o arraste. */
  dragLabel?: string | null;
  /** Posição do ponteiro ao longo da fileira (cm) quando a peça é solta. */
  onPieceDrop(piece: Piece, axisPos: number): void;
  /** O arraste foi interrompido (virou zoom com dois dedos): desfaz a prévia sem salvar. */
  onDragCancel?(): void;
  /** Elementos sobre a planta (no celular, a faixa de ferramentas). */
  overlay?: ReactNode;
}

type Drag =
  | { kind: 'pan'; start: Point; view: View; moved: boolean; piece?: Piece }
  | { kind: 'floor' | 'row' | 'piece'; start: Point; startCm: Point; moved: boolean; piece?: Piece; delta: Point; free?: boolean }
  | null;

export default function Plan2D(props: Props) {
  const { result, rooms, tile, layout, tool, furniture, selected, onSelect } = props;
  const ref = useRef<HTMLDivElement>(null);
  const bounds = useMemo(() => bbox(rooms.map((r) => r.ring)), [rooms]);
  const { view, setView, toWorld, fit } = usePanZoom(ref, bounds.w + 2 * MARGIN, bounds.h + 2 * MARGIN);
  const [drag, setDrag] = useState<Drag>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const magnet = useEditor((s) => s.magnet);
  const setMagnet = useEditor((s) => s.setMagnet);

  const ox = bounds.x - MARGIN;
  const oy = bounds.y - MARGIN;
  const toCm = (e: { clientX: number; clientY: number }): Point => {
    const w = toWorld(e.clientX, e.clientY);
    return { x: w.x + ox, y: w.y + oy };
  };
  const vertical = layout.rotationDeg === 90;
  const along = (d: Point) => (vertical ? d.y : d.x);

  const k = view.k;
  /** Alcance do ímã em cm no zoom atual; zero quando está livre (Shift ou Ímã desligado). */
  const snapTol = (e: { shiftKey: boolean }) => (e.shiftKey || !magnet ? 0 : SNAP_PX / k);
  const tileScreen = Math.min(tile.lengthCm, tile.widthCm) * k;
  const showNumbers = tileScreen >= 24;
  const showCuts = tileScreen >= 52;
  const fontSize = 11.5 / k;
  const entrances = useMemo(
    () =>
      entrancePoints(layout, rooms).flatMap((p) => {
        const piece = entrancePiece(result, p);
        return piece ? [{ piece }] : [];
      }),
    [layout, rooms, result],
  );
  const pieceByKey = useMemo(() => new Map(result.pieces.map((p) => [p.key, p])), [result]);
  const sel = selected ? pieceByKey.get(selected) : undefined;

  /**
   * Ímã da peça arrastada: quanto ela anda para cair na vaga onde seria solta (o mesmo cálculo
   * de quando solta). Null se a fileira não for uma faixa reta (aí ela segue o mouse).
   */
  const slotShift = (piece: Piece, mouseAlong: number): number | null => {
    const span = (p: Piece) => {
      const b = bbox(p.shape);
      return vertical ? { start: b.y, len: b.h } : { start: b.x, len: b.w };
    };
    const row = result.pieces.filter((p) => p.roomId === piece.roomId && p.row === piece.row).sort((a, b) => span(a).start - span(b).start);
    const frameRow = vertical ? row.map((p) => ({ ...p, shape: p.shape.map(swapXY) })) : row;
    if (!rowIsStrip(frameRow, pitch(tile).joint)) return null;
    const moving = row.findIndex((p) => p.key === piece.key);
    if (moving < 0) return null;
    const spans = row.map(span);
    const others = spans.filter((_, i) => i !== moving).map((s) => s.start + s.len / 2);
    return slotStart(spans, moving, targetIndex(others, mouseAlong), pitch(tile).joint) - spans[moving].start;
  };

  const pieceUnder = (target: EventTarget) => {
    const el = (target as Element).closest('[data-piece]');
    return el ? pieceByKey.get(el.getAttribute('data-piece')!) : undefined;
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY };
    const piece = pieceUnder(e.target);
    const pan = () => setDrag({ kind: 'pan', start, view, moved: false, piece });
    if (e.button !== 0 || tool === 'start' || !piece) return pan();
    if (tool === 'piece') onSelect(piece.key);
    setDrag({ kind: tool, start, startCm: toCm(e), moved: false, piece, delta: { x: 0, y: 0 } });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) >= CLICK_PX;
    if (!moved) return;
    if (drag.kind === 'pan') {
      setView({ ...drag.view, tx: drag.view.tx + e.clientX - drag.start.x, ty: drag.view.ty + e.clientY - drag.start.y });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    const cm = toCm(e);
    const delta = { x: Math.round((cm.x - drag.startCm.x) * 2) / 2, y: Math.round((cm.y - drag.startCm.y) * 2) / 2 };
    setDrag({ ...drag, moved: true, delta, free: snapTol(e) === 0 });
    const rect = ref.current!.getBoundingClientRect();
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const tol = snapTol(e);
    if (drag.kind === 'floor') props.onFloorDrag(delta, false, drag.piece, tol);
    if (drag.kind === 'row' && drag.piece) props.onRowDrag(drag.piece, along(delta), false, tol);
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag;
    setDrag(null);
    setPointer(null);
    if (!d) return;
    if (d.kind === 'pan') {
      if (d.moved) return;
      if (tool === 'start' && e.button === 0) props.onStart(toCm(e));
      else onSelect(d.piece?.key ?? null);
      return;
    }
    if (!d.moved) {
      onSelect(d.piece?.key ?? null);
      return;
    }
    if (d.kind === 'floor') props.onFloorDrag(d.delta, true, d.piece, snapTol(e));
    if (d.kind === 'row' && d.piece) props.onRowDrag(d.piece, along(d.delta), true, snapTol(e));
    if (d.kind === 'piece' && d.piece) props.onPieceDrop(d.piece, along(toCm(e)));
  };

  const onPointerCancel = () => {
    const d = drag;
    setDrag(null);
    setPointer(null);
    if (d && d.kind !== 'pan' && d.moved) props.onDragCancel?.();
  };

  const ghost = drag && drag.kind === 'piece' && drag.moved && drag.piece ? drag : null;
  const ghostAlong = ghost ? (ghost.free ? along(ghost.delta) : (slotShift(ghost.piece!, along(ghost.startCm) + along(ghost.delta)) ?? along(ghost.delta))) : 0;
  const ghostShift = ghost ? (vertical ? { x: 0, y: ghostAlong } : { x: ghostAlong, y: 0 }) : null;
  const cursor =
    drag?.kind === 'pan' && drag.moved
      ? 'grabbing'
      : tool === 'start'
        ? 'crosshair'
        : tool === 'floor'
          ? 'move'
          : tool === 'row'
            ? vertical
              ? 'ns-resize'
              : 'ew-resize'
            : 'grab';

  return (
    <div className="canvas canvas-plain" ref={ref}>
      <div className="toolbar">
        <FitButton onClick={fit} />
        <MagnetButton
          on={magnet}
          onClick={() => setMagnet(!magnet)}
          title="Ímã: o piso e as fileiras grudam quando a peça encosta na parede. Segure Shift para mexer livre na hora."
        />
      </div>
      <svg
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor }}
        aria-label="Montagem do piso"
      >
        <g transform={`translate(${view.tx},${view.ty}) scale(${k}) translate(${-ox},${-oy})`}>
          <PlanSvg
            result={result}
            rooms={rooms}
            fontSize={fontSize}
            showNumbers={showNumbers}
            showCuts={showCuts}
            hairline={showNumbers ? 1 : 0.6}
          />
          {furniture && (
            <image
              href={furniture.url}
              x={0}
              y={0}
              width={furniture.w}
              height={furniture.h}
              opacity={0.9}
              style={{ mixBlendMode: 'multiply' }}
              pointerEvents="none"
            />
          )}
          {sel &&
            sel.shape.map((ring, i) => (
              <polygon
                key={i}
                points={ring.map((q) => `${q.x},${q.y}`).join(' ')}
                fill="none"
                stroke="#f2c230"
                strokeWidth={4}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
          {props.guides?.map((g, i) => (
            <line
              key={`parede${i}`}
              x1={g.a.x}
              y1={g.a.y}
              x2={g.b.x}
              y2={g.b.y}
              stroke="#2f7d4f"
              strokeWidth={g.joint ? 2 : 6}
              strokeDasharray={g.joint ? '6 4' : undefined}
              strokeLinecap={g.joint ? 'butt' : 'round'}
              opacity={0.85}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          {ghost &&
            ghostShift &&
            ghost.piece!.shape.map((ring, i) => (
              <polygon
                key={`g${i}`}
                points={ring.map((q) => `${q.x + ghostShift.x},${q.y + ghostShift.y}`).join(' ')}
                fill="rgba(242,194,48,0.45)"
                stroke="#b88a06"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
          {entrances.map(({ piece }) => (
            <EntranceMark key={piece.key} piece={piece} k={k} />
          ))}
        </g>
      </svg>
      {pointer && props.dragLabel && (
        <div className={`measure-badge${props.guides?.length ? ' snapped' : ''}`} style={{ left: pointer.x, top: pointer.y }}>
          {props.dragLabel}
        </div>
      )}
      {props.overlay}
      <Hint>{TOOL_HINT[tool]}</Hint>
    </div>
  );
}

/** Peça da entrada: contorno amarelo e a etiqueta "Entrada" em cima, do mesmo tamanho em qualquer zoom. */
export function EntranceMark({ piece, k }: { piece: Piece; k: number }) {
  const b = bbox(piece.shape);
  const fs = 12 / k;
  const w = fs * 4.6;
  const h = fs * 1.6;
  const cx = b.x + b.w / 2;
  return (
    <g pointerEvents="none">
      {piece.shape.map((ring, i) => (
        <g key={i}>
          <polygon points={ring.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#22262a" strokeWidth={6} vectorEffect="non-scaling-stroke" />
          <polygon points={ring.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#f2c230" strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      <rect x={cx - w / 2} y={b.y - h - fs * 0.35} width={w} height={h} rx={h / 2} fill="#f2c230" stroke="#22262a" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <text x={cx} y={b.y - fs * 0.35 - h / 2 + fs * 0.36} fontSize={fs} fontWeight={700} textAnchor="middle" fill="#22262a">
        Entrada
      </text>
    </g>
  );
}

