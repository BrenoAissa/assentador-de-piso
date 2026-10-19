import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { bbox } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import type { LayoutResult, LayoutSpec, Piece, RoomCm, TileSpec } from '../tiling/types';
import { usePanZoom, type View } from '../ui/usePanZoom';
import PlanSvg from './PlanSvg';

const MARGIN = 40;
const CLICK_PX = 4;

export type MontarTool = 'start' | 'floor' | 'row' | 'piece';

export const TOOL_HINT: Record<MontarTool, string> = {
  start: 'Clique onde o piso deve começar, por exemplo na porta de entrada. A peça ali fica inteira e os recortes vão para as paredes do outro lado.',
  floor: 'Arraste o piso inteiro para mudar onde caem os recortes. Arraste o fundo para mover a vista.',
  row: 'Arraste uma peça para deslizar a fileira dela. Bom para levar o filete para baixo de um móvel.',
  piece: 'Arraste uma peça ao longo da fileira para trocar de lugar; as outras se acomodam. Clique numa peça para apagar ou marcar como embaixo de móvel.',
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
  /** Deslocamento em cm desde o início do arraste; `piece` é a peça onde o arraste começou. */
  onFloorDrag(delta: Point, done: boolean, piece?: Piece): void;
  /** Deslocamento em cm ao longo da fileira. */
  onRowDrag(piece: Piece, delta: number, done: boolean): void;
  /** Posição do ponteiro ao longo da fileira (cm) quando a peça é solta. */
  onPieceDrop(piece: Piece, axisPos: number): void;
}

type Drag =
  | { kind: 'pan'; start: Point; view: View; moved: boolean; piece?: Piece }
  | { kind: 'floor' | 'row' | 'piece'; start: Point; startCm: Point; moved: boolean; piece?: Piece; delta: Point }
  | null;

export default function Plan2D(props: Props) {
  const { result, rooms, tile, layout, tool, furniture, selected, onSelect } = props;
  const ref = useRef<HTMLDivElement>(null);
  const bounds = useMemo(() => bbox(rooms.map((r) => r.ring)), [rooms]);
  const { view, setView, toWorld, fit } = usePanZoom(ref, bounds.w + 2 * MARGIN, bounds.h + 2 * MARGIN);
  const [drag, setDrag] = useState<Drag>(null);

  const ox = bounds.x - MARGIN;
  const oy = bounds.y - MARGIN;
  const toCm = (e: { clientX: number; clientY: number }): Point => {
    const w = toWorld(e.clientX, e.clientY);
    return { x: w.x + ox, y: w.y + oy };
  };
  const vertical = layout.rotationDeg === 90;
  const along = (d: Point) => (vertical ? d.y : d.x);

  const k = view.k;
  const tileScreen = Math.min(tile.lengthCm, tile.widthCm) * k;
  const showNumbers = tileScreen >= 24;
  const showCuts = tileScreen >= 52;
  const fontSize = 11.5 / k;
  const origin = result.originUsed;
  const pieceByKey = useMemo(() => new Map(result.pieces.map((p) => [p.key, p])), [result]);
  const sel = selected ? pieceByKey.get(selected) : undefined;

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
    setDrag({ ...drag, moved: true, delta });
    if (drag.kind === 'floor') props.onFloorDrag(delta, false, drag.piece);
    if (drag.kind === 'row' && drag.piece) props.onRowDrag(drag.piece, along(delta), false);
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag;
    setDrag(null);
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
    if (d.kind === 'floor') props.onFloorDrag(d.delta, true, d.piece);
    if (d.kind === 'row' && d.piece) props.onRowDrag(d.piece, along(d.delta), true);
    if (d.kind === 'piece' && d.piece) props.onPieceDrop(d.piece, along(toCm(e)));
  };

  const ghost = drag && drag.kind === 'piece' && drag.moved && drag.piece ? drag : null;
  const ghostShift = ghost ? (vertical ? { x: 0, y: ghost.delta.y } : { x: ghost.delta.x, y: 0 }) : null;
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
        <button className="tool" onClick={fit}>
          Enquadrar
        </button>
      </div>
      <svg
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
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
          {(tool === 'start' || tool === 'floor') && (
            <g pointerEvents="none">
              <line x1={bounds.x - MARGIN / 2} x2={bounds.x + bounds.w + MARGIN / 2} y1={origin.y} y2={origin.y} stroke="#f2c230" strokeWidth={2} strokeDasharray="10 5" vectorEffect="non-scaling-stroke" />
              <line y1={bounds.y - MARGIN / 2} y2={bounds.y + bounds.h + MARGIN / 2} x1={origin.x} x2={origin.x} stroke="#f2c230" strokeWidth={2} strokeDasharray="10 5" vectorEffect="non-scaling-stroke" />
              <circle cx={origin.x} cy={origin.y} r={7 / k} fill="#f2c230" stroke="#22262a" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </g>
      </svg>
      <p className="hint">{TOOL_HINT[tool]}</p>
    </div>
  );
}
