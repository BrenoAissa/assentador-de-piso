import type { LayoutSpec, TileSpec } from '../tiling/types';

/** Amostra de 3 fileiras com o deslocamento `shift` (fração da peça). */
function Thumb({ shift }: { shift: number }) {
  const rows = [0, 1, 2];
  return (
    <svg viewBox="0 0 64 34" width="64" height="34" aria-hidden="true">
      <rect width="64" height="34" fill="#7d848a" />
      {rows.map((r) => {
        const off = ((r * shift) % 1) * 20;
        return [-1, 0, 1, 2, 3].map((c) => (
          <rect key={`${r}-${c}`} x={c * 21 - off + 1} y={r * 11 + 1} width={20} height={10} fill="#d6dadd" />
        ));
      })}
    </svg>
  );
}

const PATTERNS: { id: string; label: string; patch: Partial<LayoutSpec>; shift: number }[] = [
  { id: 'straight', label: 'Alinhado', patch: { pattern: 'straight' }, shift: 0 },
  { id: 'half', label: 'Tijolinho', patch: { pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 2 } }, shift: 1 / 2 },
  { id: 'third', label: 'Escada', patch: { pattern: 'running', runningOffset: { kind: 'fraction', value: 1 / 3 } }, shift: 1 / 3 },
];

function currentPattern(l: LayoutSpec): string | null {
  if (l.pattern === 'straight') return 'straight';
  if (l.runningOffset.kind !== 'fraction') return null;
  if (Math.abs(l.runningOffset.value - 1 / 2) < 1e-6) return 'half';
  if (Math.abs(l.runningOffset.value - 1 / 3) < 1e-6) return 'third';
  return null;
}

/** Como as fileiras se encaixam, escolhido pelo desenho. */
export function PatternPicker({ layout, onChange }: { layout: LayoutSpec; onChange(patch: Partial<LayoutSpec>): void }) {
  const cur = currentPattern(layout);
  return (
    <fieldset className="seg-field">
      <legend>Como as fileiras se encaixam</legend>
      <div className="thumb-picker">
        {PATTERNS.map((p) => (
          <button key={p.id} aria-pressed={cur === p.id} onClick={() => onChange(p.patch)}>
            <Thumb shift={p.shift} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Peça retangular deitada ou em pé na planta. Some para peça quadrada. */
export function OrientationPicker({
  tile,
  layout,
  onChange,
}: {
  tile: TileSpec;
  layout: LayoutSpec;
  onChange(patch: Partial<LayoutSpec>): void;
}) {
  if (Math.abs(tile.lengthCm - tile.widthCm) < 0.01) return null;
  const option = (deg: 0 | 90, label: string) => (
    <button aria-pressed={layout.rotationDeg === deg} onClick={() => onChange({ rotationDeg: deg })}>
      <svg viewBox="0 0 64 34" width="64" height="34" aria-hidden="true">
        <rect width="64" height="34" fill="#7d848a" />
        {deg === 0
          ? [0, 1, 2].map((r) => <rect key={r} x={2} y={r * 11 + 1} width={60} height={10} fill="#d6dadd" />)
          : [0, 1, 2, 3, 4].map((c) => <rect key={c} x={c * 13 + 1} y={1} width={11} height={32} fill="#d6dadd" />)}
      </svg>
      <span>{label}</span>
    </button>
  );
  return (
    <fieldset className="seg-field">
      <legend>Peça na planta</legend>
      <div className="thumb-picker">
        {option(0, 'Deitada')}
        {option(90, 'Em pé')}
      </div>
    </fieldset>
  );
}
