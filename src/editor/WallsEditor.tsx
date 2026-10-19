import { useEffect, useState } from 'react';
import type { Ring } from '../geometry/types';
import { useProject } from '../store/project';
import { edgeLengths, setEdgeLength } from './drawing';
import { useEditor } from './editorStore';

/** Seta da direção da parede na planta (y para baixo). */
function arrow(ring: Ring, i: number): string {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return arrows[(Math.round(ang / 45) + 8) % 8];
}

function WallInput({ cm, onCommit, onFocus, onBlur }: { cm: number; onCommit(v: number): void; onFocus(): void; onBlur(): void }) {
  const shown = String(Math.round(cm * 10) / 10).replace('.', ',');
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(shown);
  }, [shown, focused]);
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (v > 0 && Math.abs(v - cm) > 0.05) onCommit(v);
  };
  return (
    <input
      className="input"
      inputMode="decimal"
      aria-label="Comprimento da parede em cm"
      value={text}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => {
        setFocused(false);
        commit();
        onBlur();
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

/** Paredes do cômodo com o comprimento em cm; mudar o valor move a parede na planta. */
export default function WallsEditor({ roomId, ring, pxPerCm }: { roomId: string; ring: Ring; pxPerCm: number }) {
  const updateRoom = useProject((s) => s.updateRoom);
  const setHighlight = useEditor((s) => s.setHighlight);
  const lengths = edgeLengths(ring);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <span className="muted">Paredes (cm), no sentido do desenho:</span>
      <ul className="walls-list">
        {lengths.map((px, i) => (
          <li key={i}>
            <span>
              {arrow(ring, i)} Parede {i + 1}
            </span>
            <WallInput
              cm={px / pxPerCm}
              onCommit={(cm) => updateRoom(roomId, { polygonPx: setEdgeLength(ring, i, cm * pxPerCm) })}
              onFocus={() => setHighlight({ roomId, index: i })}
              onBlur={() => setHighlight(null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
