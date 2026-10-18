import { canAdvance } from '../store/issues';
import { useProject } from '../store/project';
import { validateTile } from '../tiling/validate';
import LayoutControls from './LayoutControls';
import NumField from './NumField';
import TilePreview from './TilePreview';

const PRESETS: { label: string; l: number; w: number; joint: number }[] = [
  { label: '60 × 60', l: 60, w: 60, joint: 2 },
  { label: '90 × 90', l: 90, w: 90, joint: 2 },
  { label: '120 × 60', l: 120, w: 60, joint: 2 },
  { label: 'Régua 120 × 20', l: 120, w: 20, joint: 0 },
];

export default function StepTile() {
  const project = useProject((s) => s.project);
  const { setTile, setLayout, setStep } = useProject.getState();
  const { tile, layout } = project;
  const errors = validateTile(tile, layout);
  const next = canAdvance(project, 3);

  return (
    <div className="workspace">
      <div className="canvas canvas-plain">
        <TilePreview tile={tile} layout={layout} />
      </div>
      <aside className="panel" aria-label="Piso">
        <section className="panel-section">
          <h3>Peça</h3>
          <div className="chips">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="btn btn-sm"
                aria-pressed={tile.lengthCm === p.l && tile.widthCm === p.w}
                onClick={() => setTile({ lengthCm: p.l, widthCm: p.w, jointMm: p.joint })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="row-2">
            <NumField label="Comprimento" suffix="cm" value={tile.lengthCm} onChange={(v) => setTile({ lengthCm: v })} />
            <NumField label="Largura" suffix="cm" value={tile.widthCm} onChange={(v) => setTile({ widthCm: v })} />
          </div>
          <NumField label="Rejunte (0 para régua sem rejunte)" suffix="mm" value={tile.jointMm} onChange={(v) => setTile({ jointMm: v })} />
        </section>

        <section className="panel-section">
          <LayoutControls />
        </section>

        <section className="panel-section">
          <h3>Compra</h3>
          <div className="row-2">
            <NumField label="Peças por caixa" value={tile.piecesPerBox} onChange={(v) => setTile({ piecesPerBox: v })} />
            <NumField
              label="m² por caixa"
              suffix="m²"
              optional
              value={tile.m2PerBox}
              onChange={(v) => setTile({ m2PerBox: Number.isNaN(v) ? undefined : v })}
            />
          </div>
          <NumField label="Margem de perda (quebras)" suffix="%" value={tile.wastePct} onChange={(v) => setTile({ wastePct: v })} />
        </section>

        <details className="panel-section advanced">
          <summary>Ajustes finos</summary>
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
                Contínua no apartamento
              </button>
              <button aria-pressed={layout.gridMode === 'perRoom'} onClick={() => setLayout({ gridMode: 'perRoom' })}>
                Uma por cômodo
              </button>
            </div>
          </fieldset>
        </details>

        <footer className="panel-footer">
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
              Ver resultado
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
