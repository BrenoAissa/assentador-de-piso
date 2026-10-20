import { isSample } from '../sample';
import { useProject } from '../store/project';
import { emptyProject } from '../types';

/** Aviso no topo do painel enquanto a pessoa explora o apartamento de exemplo. */
export default function SampleNotice() {
  const sample = useProject((s) => isSample(s.project));
  if (!sample) return null;
  return (
    <div className="sample-notice" role="note">
      <p>
        <strong>Apartamento de exemplo.</strong> Mexa à vontade: escolha por onde começar, troque o encaixe, veja em 3D.
      </p>
      <button className="btn btn-sm btn-primary" onClick={() => void useProject.getState().replaceProject(emptyProject(), null)}>
        Fazer o meu
      </button>
    </div>
  );
}
