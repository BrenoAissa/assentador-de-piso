import { createPortal } from 'react-dom';
import { bbox } from '../geometry/polygon';
import type { LayoutResult, RoomCm, TileSpec, LayoutSpec } from '../tiling/types';
import { fmt, patternLabel } from '../ui/format';
import CutTable from './CutTable';
import PlanSvg from './PlanSvg';
import Summary from './Summary';
import './print.css';

interface Props {
  result: LayoutResult;
  rooms: RoomCm[];
  tile: TileSpec;
  layout: LayoutSpec;
}

/** Folha de impressão: só aparece no papel (window.print). */
export default function PrintSheet({ result, rooms, tile, layout }: Props) {
  const b = bbox(rooms.map((r) => r.ring));
  const m = 20;
  const font = Math.min(tile.lengthCm, tile.widthCm) * 0.26;
  return createPortal(
    <div className="print-sheet">
      <h1>Paginação do piso</h1>
      <p>
        Peça de {fmt(tile.lengthCm)} × {fmt(tile.widthCm)} cm, rejunte de {fmt(tile.jointMm)} mm,{' '}
        {patternLabel(layout).toLowerCase()}, comprimento na {layout.rotationDeg === 90 ? 'vertical' : 'horizontal'} da
        planta. Medidas dos recortes em cm, já descontado o rejunte.
      </p>
      <svg viewBox={`${b.x - m} ${b.y - m} ${b.w + 2 * m} ${b.h + 2 * m}`}>
        <PlanSvg result={result} rooms={rooms} fontSize={font} showNumbers showCuts hairline={0.5} scalingStroke />
        <circle cx={result.originUsed.x} cy={result.originUsed.y} r={font * 0.45} fill="#f2c230" stroke="#22262a" strokeWidth={0.8} />
      </svg>
      <p className="print-legend">
        Cinza: peça inteira. Azul: recortada. Vermelho: filete. Borda tracejada: sai da sobra de outra peça. Ponto
        amarelo: canto de partida da grade.
      </p>
      <Summary summary={result.summary} tile={tile} />
      <CutTable result={result} rooms={rooms} />
    </div>,
    document.body,
  );
}
