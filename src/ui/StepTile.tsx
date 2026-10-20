import { hasEdits } from '../store/edits';
import { canAdvance } from '../store/issues';
import { useProject } from '../store/project';
import { validateTile } from '../tiling/validate';
import { OrientationPicker } from './LayoutPickers';
import NumField from './NumField';
import TilePreview from './TilePreview';
import SampleNotice from './SampleNotice';

const PRESETS: { label: string; hint: string; l: number; w: number; joint: number }[] = [
  { label: '60 × 60', hint: 'porcelanato', l: 60, w: 60, joint: 2 },
  { label: '90 × 90', hint: 'porcelanato', l: 90, w: 90, joint: 2 },
  { label: '120 × 60', hint: 'porcelanato', l: 120, w: 60, joint: 2 },
  { label: '120 × 20', hint: 'vinílico / laminado', l: 120, w: 20, joint: 0 },
];

/** Desenho da peça na proporção certa, cabendo numa caixa de 44 px. */
function TileShape({ l, w }: { l: number; w: number }) {
  const k = 40 / Math.max(l, w);
  return (
    <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
      <rect x={22 - (l * k) / 2} y={22 - (w * k) / 2} width={l * k} height={w * k} fill="#d6dadd" stroke="#5f666c" />
    </svg>
  );
}

export default function StepTile() {
  const project = useProject((s) => s.project);
  const { setTile, setLayout, setStep } = useProject.getState();
  const { tile, layout } = project;
  const errors = validateTile(tile, layout);
  const next = canAdvance(project, 3);
  const isPreset = (p: (typeof PRESETS)[number]) => tile.lengthCm === p.l && tile.widthCm === p.w;

  return (
    <div className="workspace">
      <div className="canvas canvas-plain">
        <TilePreview tile={tile} layout={layout} />
      </div>
      <aside className="panel" aria-label="Piso">
        <SampleNotice />
        <section className="panel-section">
          <h3>Qual é a peça?</h3>
          <div className="tile-cards">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                aria-pressed={isPreset(p)}
                onClick={() => setTile({ lengthCm: p.l, widthCm: p.w, jointMm: p.joint })}
              >
                <TileShape l={p.l} w={p.w} />
                <span className="tile-label">{p.label} cm</span>
                <span className="muted">{p.hint}</span>
              </button>
            ))}
          </div>
          <details className="details" open={!PRESETS.some(isPreset)}>
            <summary>Outra medida</summary>
            <div className="row-2">
              <NumField label="Comprimento" suffix="cm" value={tile.lengthCm} onChange={(v) => setTile({ lengthCm: v })} />
              <NumField label="Largura" suffix="cm" value={tile.widthCm} onChange={(v) => setTile({ widthCm: v })} />
            </div>
          </details>
          <NumField label="Espaço entre as peças (rejunte)" suffix="mm" value={tile.jointMm} onChange={(v) => setTile({ jointMm: v })} />
          <OrientationPicker tile={tile} layout={layout} onChange={setLayout} />
        </section>

        <section className="panel-section">
          <h3>Compra</h3>
          <div className="row-2">
            <NumField label="Peças por caixa" value={tile.piecesPerBox} onChange={(v) => setTile({ piecesPerBox: v })} />
            <NumField
              label="ou m² por caixa"
              suffix="m²"
              optional
              value={tile.m2PerBox}
              onChange={(v) => setTile({ m2PerBox: Number.isNaN(v) ? undefined : v })}
            />
          </div>
          <NumField label="Folga para quebras" suffix="%" value={tile.wastePct} onChange={(v) => setTile({ wastePct: v })} />
        </section>

        <details className="panel-section advanced">
          <summary>Mais opções</summary>
          <div className="row-2">
            <NumField label="Filete abaixo de" suffix="cm" value={layout.minCutCm} onChange={(v) => setLayout({ minCutCm: v })} />
            <NumField
              label="ou abaixo de"
              suffix="% da peça"
              value={Math.round(layout.minCutFraction * 1000) / 10}
              onChange={(v) => setLayout({ minCutFraction: v / 100 })}
            />
          </div>
          <NumField label="Perda do disco de corte" suffix="mm" value={layout.kerfCm * 10} onChange={(v) => setLayout({ kerfCm: v / 10 })} />
          <fieldset className="seg-field">
            <legend>Grade</legend>
            <div className="segmented">
              <button aria-pressed={layout.gridMode === 'global'} onClick={() => setLayout({ gridMode: 'global' })}>
                Contínua em todo o lar
              </button>
              <button aria-pressed={layout.gridMode === 'perRoom'} onClick={() => setLayout({ gridMode: 'perRoom' })}>
                Uma por cômodo
              </button>
            </div>
          </fieldset>
        </details>

        <footer className="panel-footer">
          {hasEdits(project.edits) && (
            <p className="muted">Mudar a peça ou o espaço entre elas refaz a montagem que você ajustou.</p>
          )}
          {errors.map((e) => (
            <p key={e} className="error">
              {e}
            </p>
          ))}
          <div className="row">
            <button className="btn" onClick={() => setStep(2)}>
              Voltar aos cômodos
            </button>
            <button className="btn btn-primary" disabled={!next.ok} onClick={() => setStep(4)}>
              Montar o piso
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
