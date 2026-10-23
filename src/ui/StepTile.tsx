import { useState } from 'react';
import { floorById, roomFloorId } from '../floors';
import { hasEdits } from '../store/edits';
import { canAdvance } from '../store/issues';
import { useProject } from '../store/project';
import { validateTile } from '../tiling/validate';
import type { LayoutSpec, TileSpec } from '../types';
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
  const { setStep, addFloor, removeFloor, renameFloor, setRoomFloor } = useProject.getState();
  const [activeId, setActiveId] = useState(project.floors[0].id);
  // piso apagado (ou projeto trocado): volta para o primeiro
  const floor = floorById(project, activeId);
  const { tile, layout } = floor;
  const setTile = (patch: Partial<TileSpec>) => useProject.getState().setTile(floor.id, patch);
  const setLayout = (patch: Partial<LayoutSpec>) => useProject.getState().setLayout(floor.id, patch);
  const many = project.floors.length > 1;
  const first = project.floors[0];
  const errors = validateTile(tile, layout);
  const next = canAdvance(project, 3);
  const otherError = !next.ok && errors.length === 0 ? next.reason : null;
  const scale = project.scale;
  const roomLabel = (i: number) => project.rooms[i].name.trim() || `Cômodo ${i + 1}`;
  const floorRooms = project.rooms.filter((r) => roomFloorId(project, r) === floor.id);

  const newFloor = () => setActiveId(addFloor(floor.id));
  const deleteFloor = () => {
    if (!window.confirm(`Apagar o ${floor.name}? Os cômodos dele voltam para o ${first.name}.`)) return;
    removeFloor(floor.id);
    setActiveId(first.id);
  };
  const isPreset = (p: (typeof PRESETS)[number]) => tile.lengthCm === p.l && tile.widthCm === p.w;

  return (
    <div className="workspace">
      <div className="canvas canvas-plain">
        <TilePreview tile={tile} layout={layout} />
      </div>
      <aside className="panel" aria-label="Piso">
        <SampleNotice />
        <div className="floor-bar">
          {many && (
            <div className="floor-tabs" role="tablist" aria-label="Pisos">
              {project.floors.map((f) => (
                <button key={f.id} role="tab" aria-selected={f.id === floor.id} onClick={() => setActiveId(f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-sm btn-quiet add-floor" onClick={newFloor}>
            + Outro piso
          </button>
        </div>

        {many && (
          <section className="panel-section">
            <label className="field">
              <span>Nome do piso</span>
              <input className="input" value={floor.name} onChange={(e) => renameFloor(floor.id, e.target.value)} />
            </label>
            <h3>Cômodos com este piso</h3>
            {project.rooms.length === 0 || !scale ? (
              <p className="muted">Nenhum cômodo desenhado ainda.</p>
            ) : (
              <ul className="floor-rooms">
                {project.rooms.map((r, i) => {
                  const on = roomFloorId(project, r);
                  const elsewhere = on && on !== floor.id ? floorById(project, on).name : null;
                  return (
                    <li key={r.id}>
                      <label className="check">
                        <input type="checkbox" checked={on === floor.id} onChange={(e) => setRoomFloor(r.id, e.target.checked ? floor.id : null)} />
                        {roomLabel(i)}
                        {elsewhere && <span className="muted">no {elsewhere}</span>}
                        {!on && <span className="muted">sem piso</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {floorRooms.length === 0 && project.rooms.length > 0 && <p className="muted">Nenhum cômodo com este piso.</p>}
            {floor.id !== first.id && (
              <div>
                <button className="btn btn-sm btn-quiet btn-danger" onClick={deleteFloor}>
                  Apagar este piso
                </button>
              </div>
            )}
          </section>
        )}

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
          {otherError && <p className="error">{otherError}</p>}
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
