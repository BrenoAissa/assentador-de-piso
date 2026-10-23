import { createPortal } from 'react-dom';
import { bbox } from '../geometry/polygon';
import type { FloorInput, ProjectLayout, RoomCm } from '../tiling/types';
import { fmt, orientationLabel, patternLabel } from '../ui/format';
import CutTable from './CutTable';
import PlanSvg from './PlanSvg';
import Summary from './Summary';
import './print.css';
import { entrancePiece, entrancePoints } from '../tiling/start';

interface Props {
  result: ProjectLayout;
  rooms: RoomCm[];
  /** Pisos com cômodos, com o nome de cada um. */
  floors: (FloorInput & { name: string })[];
  /** Foto do piso em 3D visto de cima (data URL), gerada na hora de imprimir. */
  topView?: string | null;
}

/** Folha de impressão: só aparece no papel (window.print). */
export default function PrintSheet({ result, rooms, floors, topView }: Props) {
  const b = bbox(rooms.map((r) => r.ring));
  const m = 20;
  const font = Math.min(...floors.map((f) => Math.min(f.tile.lengthCm, f.tile.widthCm))) * 0.26;
  const many = floors.length > 1;
  const floorNames = Object.fromEntries(floors.map((f) => [f.id, f.name]));
  return createPortal(
    <div className="print-sheet">
      <h1>Paginação do piso</h1>
      {floors.map(({ id, name, tile, layout }) => (
        <p key={id}>
          {many && <strong>{name}: </strong>}
          peça de {fmt(tile.lengthCm)} × {fmt(tile.widthCm)} cm, rejunte de {fmt(tile.jointMm)} mm, encaixe {patternLabel(layout).toLowerCase()}
          {orientationLabel(tile, layout) && `, ${orientationLabel(tile, layout)}`}.
        </p>
      ))}
      <p>Medidas dos recortes em cm, já descontado o rejunte. Peças tracejadas sem cor foram apagadas (móvel fixo, sem piso).</p>
      <svg viewBox={`${b.x - m} ${b.y - m} ${b.w + 2 * m} ${b.h + 2 * m}`}>
        <PlanSvg result={result} rooms={rooms} fontSize={font} showNumbers showCuts hairline={0.5} scalingStroke />
        {floors.flatMap((f) =>
          entrancePoints(f.layout, f.rooms).map((p) => {
            const piece = entrancePiece({ pieces: result.pieces.filter((q) => q.floorId === f.id) }, p);
            return piece?.shape.map((ring, i) => (
              <polygon key={`${piece.key}:${i}`} points={ring.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#f2c230" strokeWidth={font * 0.3} />
            ));
          }),
        )}
      </svg>
      <p className="print-legend">
        Cinza: peça inteira. Azul: recortada. Vermelho: filete. Borda tracejada: sai da sobra de outra peça. Contorno
        amarelo: peça da entrada, por onde começar o assentamento.
      </p>
      {result.floors.map(({ floorId, result: r }) => {
        const f = floors.find((x) => x.id === floorId)!;
        return <Summary key={floorId} summary={r.summary} tile={f.tile} title={many ? f.name : undefined} expanded />;
      })}
      {topView && (
        <section className="print-3d">
          <h2>Vista 3D de cima</h2>
          <img src={topView} alt="Piso em 3D visto de cima" />
        </section>
      )}
      <CutTable layout={result} floorNames={floorNames} rooms={rooms} />
    </div>,
    document.body,
  );
}
