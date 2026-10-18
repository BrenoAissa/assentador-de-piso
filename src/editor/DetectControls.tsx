import { useDetection } from '../detection/useDetection';
import { useProject } from '../store/project';

/** Status da leitura automática por cima da planta. */
export function DetectOverlay() {
  const { status, stage, progress } = useDetection();
  if (status !== 'running') return null;
  return (
    <div className="detect-overlay" role="status">
      <span className="spinner" aria-hidden="true" />
      {stage}
      {progress !== undefined && ` (${Math.round(progress * 100)}%)`}
    </div>
  );
}

/** Avisos da detecção e "detectar de novo" com outra sensibilidade. */
export function DetectControls() {
  const { status, warnings, error, found, sensitivity, setSensitivity, run } = useDetection();
  const planBlob = useProject((s) => s.planBlob);
  const hasRooms = useProject((s) => s.project.rooms.length > 0);

  const redo = () => {
    if (!planBlob) return;
    if (hasRooms && !window.confirm('Substituir os cômodos atuais pelos que forem detectados?')) return;
    void run(planBlob);
  };

  return (
    <div className="detect-box">
      <h3>Leitura automática</h3>
      {status === 'done' && (
        <p className="muted">
          {found === 0 ? 'Nenhum cômodo encontrado.' : `${found} ${found === 1 ? 'cômodo encontrado' : 'cômodos encontrados'}.`} Confira os
          contornos sobre a planta.
        </p>
      )}
      {status === 'error' && <p className="error">{error}</p>}
      {warnings.map((w) => (
        <p key={w} className="issue">
          {w}
        </p>
      ))}
      <label className="field">
        <span>Vãos de porta e janela fechados automaticamente: {sensitivity < 1 ? 'menores' : sensitivity > 1 ? 'maiores' : 'padrão'}</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.25}
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
        />
      </label>
      <div>
        <button className="btn btn-sm" disabled={status === 'running' || !planBlob} onClick={redo}>
          {status === 'running' ? 'Lendo a planta…' : 'Detectar de novo'}
        </button>
      </div>
    </div>
  );
}
