import { canAdvance, ISSUE_TEXT } from '../store/issues';
import { useProject } from '../store/project';
import { isDrawn } from '../types';
import { useEditor } from './editorStore';
import { roomSizeLabel } from './ops';
import WallsEditor from './WallsEditor';

const fmtScale = (pxPerCm: number) =>
  `1 m = ${(pxPerCm * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} px`;

interface Props {
  /** Botão de detectar de novo (fica disponível quando a detecção existir). */
  detectSlot?: React.ReactNode;
}

export default function RoomPanel({ detectSlot }: Props) {
  const project = useProject((s) => s.project);
  const selectedRoomId = useProject((s) => s.selectedRoomId);
  const { selectRoom, updateRoom, removeRoom, setStep } = useProject.getState();
  const setTool = useEditor((s) => s.setTool);
  const { scale, rooms } = project;
  const next = canAdvance(project, 2);
  const pending = rooms.reduce((n, r) => n + r.issues.length, 0) + (scale ? 0 : 1);
  const drawn = isDrawn(project);

  return (
    <aside className="panel" aria-label="Cômodos">
      {drawn ? (
        <section className="panel-section">
          <div className="scale-line">
            <h3>Planta desenhada</h3>
            <span className="badge badge-ok">escala real</span>
          </div>
          <p className="muted">
            Tudo aqui está em centímetros. Comece por "Cômodo retangular" (largura × comprimento) ou por "Desenhar paredes",
            digitando cada medida da trena.
          </p>
        </section>
      ) : (
        <section className="panel-section">
          <div className="scale-line">
            <h3>Escala</h3>
            {scale ? (
              <span className={`badge ${scale.source === 'manual' || scale.confidence >= 0.7 ? 'badge-ok' : 'badge-warn'}`}>
                {scale.source === 'manual' ? 'calibrada' : 'lida das cotas'}
              </span>
            ) : (
              <span className="badge badge-warn">falta definir</span>
            )}
          </div>
          {scale ? (
            <p className="muted">{fmtScale(scale.pxPerCm)}. Se as medidas dos cômodos não baterem, calibre de novo.</p>
          ) : (
            <p className="muted">Sem escala o app não sabe o tamanho real. Marque uma medida conhecida na planta.</p>
          )}
          <div>
            <button className="btn btn-sm" onClick={() => setTool('calibrate')}>
              {scale ? 'Calibrar de novo' : 'Calibrar escala'}
            </button>
          </div>
        </section>
      )}

      <section className="panel-section">
        <div className="scale-line">
          <h3>Cômodos</h3>
          {pending > 0 ? (
            <span className="badge badge-warn">{pending === 1 ? '1 pendência' : `${pending} pendências`}</span>
          ) : rooms.length > 0 ? (
            <span className="badge badge-ok">tudo certo</span>
          ) : null}
        </div>

        {rooms.length === 0 && (
          <p className="muted">
            {drawn
              ? 'Nenhum cômodo ainda. Use "Cômodo retangular" ou "Desenhar paredes" na barra da planta.'
              : 'Nenhum cômodo ainda. Use "Desenhar paredes" e clique nos cantos de cada ambiente sobre a planta, ou "Cômodo retangular" com as medidas.'}
          </p>
        )}

        <ul className="room-list">
          {rooms.map((room, i) => (
            <li
              key={room.id}
              className="room-item"
              aria-selected={room.id === selectedRoomId}
              onClick={() => selectRoom(room.id)}
            >
              <div className="head">
                <input
                  className="name"
                  value={room.name}
                  placeholder={`Cômodo ${i + 1}`}
                  aria-label="Nome do cômodo"
                  onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                />
                <button
                  className="btn btn-quiet btn-sm btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRoom(room.id);
                  }}
                >
                  Excluir
                </button>
              </div>
              {scale && <span className="muted">{roomSizeLabel(room.polygonPx, scale.pxPerCm)}</span>}
              {scale && room.id === selectedRoomId && (
                <WallsEditor roomId={room.id} ring={room.polygonPx} pxPerCm={scale.pxPerCm} />
              )}
              <label className="check" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={room.receivesTile}
                  onChange={(e) => updateRoom(room.id, { receivesTile: e.target.checked })}
                />
                Recebe este piso
              </label>
              {room.issues.map((issue) => (
                <span key={issue} className="issue">
                  {ISSUE_TEXT[issue]}
                </span>
              ))}
              {room.issues.includes('low-confidence') && (
                <div>
                  <button
                    className="btn btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateRoom(room.id, { confidence: undefined });
                    }}
                  >
                    Contorno conferido
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {detectSlot}
      </section>

      <footer className="panel-footer">
        {!next.ok && <p className="error">{next.reason}</p>}
        <div className="row">
          <button className="btn" onClick={() => setStep(1)}>
            {drawn ? 'Usar uma planta' : 'Trocar planta'}
          </button>
          <button className="btn btn-primary" disabled={!next.ok} onClick={() => setStep(3)}>
            Continuar para o piso
          </button>
        </div>
      </footer>
    </aside>
  );
}
