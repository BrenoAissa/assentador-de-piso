import { useMemo } from 'react';
import { bbox } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import { pieceFill } from '../report/PlanSvg';
import { SAMPLE_DOOR, SAMPLE_ORIGIN, sampleProject } from '../sample';
import { roomsInCm } from '../store/issues';
import { computeLayout } from '../tiling/engine';
import { fmt, fmtFixed } from './format';

const pts = (ring: Ring) => ring.map((q) => `${q.x},${q.y}`).join(' ');
/** Duração da sequência de assentamento (ms), da porta até a peça mais longe. */
const LAY_MS = 1700;
const TAPE = 46;

/**
 * Apartamento de exemplo com o piso calculado pelo próprio app. As peças aparecem a partir da
 * porta de entrada, como numa obra; uma trena mede a largura do apartamento.
 */
export default function HeroPlan() {
  const { project, rooms, result } = useMemo(() => {
    const project = sampleProject();
    const rooms = roomsInCm(project);
    const origins = Object.fromEntries(rooms.map((r) => [r.id, SAMPLE_ORIGIN]));
    return { project, rooms, result: computeLayout(rooms, project.tile, project.layout, origins) };
  }, []);

  const all = project.rooms.map((r) => r.polygonPx);
  const b = bbox(all);
  const pad = 30;
  const vb = { x: b.x - pad, y: b.y - TAPE - 22, w: b.w + 2 * pad, h: b.h + TAPE + 22 + 60 };
  const far = Math.max(...result.pieces.map((p) => dist(p.tileRect.x + p.tileRect.w / 2, p.tileRect.y + p.tileRect.h / 2)));
  const delay = (x: number, y: number) => Math.round((dist(x, y) / far) * LAY_MS);
  const s = result.summary;

  return (
    <figure className="hero-plan">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label="Apartamento de exemplo com o piso assentado a partir da porta">
        <Tape x={b.x} y={b.y - TAPE - 14} w={b.w} />
        {project.rooms
          .filter((r) => !r.receivesTile)
          .map((r) => (
            <polygon key={r.id} points={pts(r.polygonPx)} className="hero-other" />
          ))}
        {rooms.map((r) => (
          <polygon key={r.id} points={pts(r.ring)} fill="#6b7177" />
        ))}
        {result.pieces.map((p) => {
          const c = { x: p.tileRect.x + p.tileRect.w / 2, y: p.tileRect.y + p.tileRect.h / 2 };
          return p.shape.map((ring, i) => (
            <polygon
              key={`${p.key}:${i}`}
              className="lay"
              style={{ animationDelay: `${delay(c.x, c.y)}ms` }}
              points={pts(ring)}
              fill={pieceFill(p)}
              stroke="#fff"
              strokeWidth={1.2}
            />
          ));
        })}
        {project.rooms.map((r) => (
          <polygon key={`w${r.id}`} points={pts(r.polygonPx)} fill="none" stroke="#22262a" strokeWidth={5} />
        ))}
        {project.rooms.map((r) => {
          const rb = bbox([r.polygonPx]);
          const big = r.id === 'ex-sala';
          const x = rb.x + rb.w / 2;
          const y = big ? rb.y + 125 : rb.y + rb.h / 2 + 10;
          return (
            <text key={`n${r.id}`} className="hero-room" x={x} y={y}>
              {r.name}
              {!r.receivesTile && (
                <tspan className="hero-room-note" x={x} dy={30}>
                  outro piso
                </tspan>
              )}
            </text>
          );
        })}
        <g className="hero-door" transform={`translate(${SAMPLE_DOOR.x} ${SAMPLE_DOOR.y})`}>
          <circle r={13} />
          <text y={44}>porta</text>
        </g>
      </svg>
      <figcaption>
        <ul className="legend" aria-label="Legenda">
          <li>
            <i style={{ background: '#c9ced2' }} /> Peça inteira
          </li>
          <li>
            <i style={{ background: '#8db3e2' }} /> Recortada
          </li>
          <li>
            <i style={{ background: '#ee8a7f' }} /> Filete (tira fina)
          </li>
        </ul>
        <p className="muted">
          Exemplo: {fmt(s.areaM2)} m² de porcelanato 60 × 60 cm, {s.boxes} caixas e{' '}
          {s.slivers === 0 ? 'nenhum filete à vista' : `${s.slivers} filetes`}.
        </p>
      </figcaption>
    </figure>
  );
}

function dist(x: number, y: number) {
  return Math.hypot(x - SAMPLE_DOOR.x, y - SAMPLE_DOOR.y);
}

/** Trena amarela com marcas a cada 10 cm e números a cada metro. */
function Tape({ x, y, w }: { x: number; y: number; w: number }) {
  const ticks = [];
  for (let cm = 0; cm <= w; cm += 10) {
    const major = cm % 100 === 0;
    const half = cm % 50 === 0;
    ticks.push(<line key={cm} x1={x + cm} x2={x + cm} y1={y} y2={y + (major ? 24 : half ? 16 : 9)} />);
    if (major && cm > 0 && cm < w - 60) {
      ticks.push(
        <text key={`t${cm}`} x={x + cm - 5} y={y + 40}>
          {cm / 100}
        </text>,
      );
    }
  }
  return (
    <g className="hero-tape">
      <rect x={x} y={y} width={w} height={TAPE} rx={3} />
      {ticks}
      <text className="hero-tape-total" x={x + w - 8} y={y + 40}>
        {fmtFixed(w / 100, 2)} m
      </text>
    </g>
  );
}
