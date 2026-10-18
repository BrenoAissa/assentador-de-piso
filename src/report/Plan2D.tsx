import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { bbox } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import type { LayoutResult, RoomCm, TileSpec } from '../tiling/types';
import { usePanZoom, type View } from '../ui/usePanZoom';
import PlanSvg from './PlanSvg';

const MARGIN = 40;

interface Props {
  result: LayoutResult;
  rooms: RoomCm[];
  tile: TileSpec;
  selected: number | null;
  onSelect(n: number | null): void;
  /** Ausente = ponto de partida não arrastável (modo por cômodo). */
  onOriginDrag?: (o: Point, done: boolean) => void;
}

type Drag = { kind: 'pan'; start: Point; view: View; moved: boolean } | { kind: 'origin' } | null;

export default function Plan2D({ result, rooms, tile, selected, onSelect, onOriginDrag }: Props) {
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

  const k = view.k;
  const tileScreen = Math.min(tile.lengthCm, tile.widthCm) * k;
  const showNumbers = tileScreen >= 24;
  const showCuts = tileScreen >= 52;
  const fontSize = 11.5 / k;
  const origin = result.originUsed;
  const sel = selected !== null ? result.pieces.find((p) => p.n === selected) : undefined;

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if ((e.target as Element).closest('[data-origin]') && onOriginDrag) {
      setDrag({ kind: 'origin' });
      return;
    }
    setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, view, moved: false });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.kind === 'origin') {
      const p = toCm(e);
      onOriginDrag?.({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }, false);
      return;
    }
    const dx = e.clientX - drag.start.x;
    const dy = e.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    setView({ ...drag.view, tx: drag.view.tx + dx, ty: drag.view.ty + dy });
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag?.kind === 'origin') {
      const p = toCm(e);
      onOriginDrag?.({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }, true);
    } else if (drag?.kind === 'pan' && !drag.moved) {
      const hit = (e.target as Element).closest('[data-piece]');
      onSelect(hit ? Number(hit.getAttribute('data-piece')) : null);
    }
    setDrag(null);
  };

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
        style={{ cursor: drag?.kind === 'pan' && drag.moved ? 'grabbing' : 'default' }}
        aria-label="Planta paginada"
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
          <g data-origin style={{ cursor: onOriginDrag ? 'move' : 'default' }}>
            <line
              x1={bounds.x - MARGIN / 2}
              x2={bounds.x + bounds.w + MARGIN / 2}
              y1={origin.y}
              y2={origin.y}
              stroke="#f2c230"
              strokeWidth={2}
              strokeDasharray="10 5"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <line
              y1={bounds.y - MARGIN / 2}
              y2={bounds.y + bounds.h + MARGIN / 2}
              x1={origin.x}
              x2={origin.x}
              stroke="#f2c230"
              strokeWidth={2}
              strokeDasharray="10 5"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <circle cx={origin.x} cy={origin.y} r={9 / k} fill="#f2c230" stroke="#22262a" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>
        </g>
      </svg>
      <p className="hint">
        {onOriginDrag
          ? 'O ponto amarelo é o canto de partida da grade, como a linha de giz do assentador. Arraste para testar outro ponto. Clique numa peça para ver o recorte.'
          : 'Clique numa peça para ver o recorte. No modo de uma grade por cômodo, cada cômodo usa o próprio ponto de partida.'}
      </p>
    </div>
  );
}
