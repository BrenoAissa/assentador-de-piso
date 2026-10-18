import { useProject } from '../store/project';
import type { LayoutSpec } from '../tiling/types';
import NumField from './NumField';

type OffsetChoice = 'half' | 'third' | 'quarter' | 'cm';

function offsetChoice(l: LayoutSpec): OffsetChoice {
  if (l.runningOffset.kind === 'cm') return 'cm';
  const v = l.runningOffset.value;
  if (Math.abs(v - 1 / 3) < 1e-6) return 'third';
  if (Math.abs(v - 1 / 4) < 1e-6) return 'quarter';
  return 'half';
}

const FRACTIONS: Record<Exclude<OffsetChoice, 'cm'>, number> = { half: 1 / 2, third: 1 / 3, quarter: 1 / 4 };

/** Paginação, deslocamento e direção — usados no passo 3 e no resultado. */
export default function LayoutControls() {
  const layout = useProject((s) => s.project.layout);
  const tile = useProject((s) => s.project.tile);
  const setLayout = useProject((s) => s.setLayout);
  const choice = offsetChoice(layout);

  return (
    <>
      <fieldset className="seg-field">
        <legend>Paginação</legend>
        <div className="segmented">
          <button aria-pressed={layout.pattern === 'straight'} onClick={() => setLayout({ pattern: 'straight' })}>
            Reta
          </button>
          <button aria-pressed={layout.pattern === 'running'} onClick={() => setLayout({ pattern: 'running' })}>
            Amarração
          </button>
        </div>
      </fieldset>

      {layout.pattern === 'running' && (
        <div className="row-2">
          <label className="field">
            <span>Deslocamento entre fileiras</span>
            <select
              className="input"
              value={choice}
              onChange={(e) => {
                const c = e.target.value as OffsetChoice;
                setLayout({
                  runningOffset:
                    c === 'cm' ? { kind: 'cm', value: Math.round(tile.lengthCm / 3) } : { kind: 'fraction', value: FRACTIONS[c] },
                });
              }}
            >
              <option value="half">1/2 da peça</option>
              <option value="third">1/3 da peça</option>
              <option value="quarter">1/4 da peça</option>
              <option value="cm">Valor em cm</option>
            </select>
          </label>
          {choice === 'cm' && (
            <NumField
              label="Deslocamento"
              suffix="cm"
              value={layout.runningOffset.value}
              onChange={(v) => setLayout({ runningOffset: { kind: 'cm', value: v } })}
            />
          )}
        </div>
      )}

      <fieldset className="seg-field">
        <legend>Comprimento da peça na planta</legend>
        <div className="segmented">
          <button aria-pressed={layout.rotationDeg === 0} onClick={() => setLayout({ rotationDeg: 0 })}>
            Na horizontal
          </button>
          <button aria-pressed={layout.rotationDeg === 90} onClick={() => setLayout({ rotationDeg: 90 })}>
            Na vertical
          </button>
        </div>
      </fieldset>
    </>
  );
}
