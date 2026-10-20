import { useRef, useState, type ReactNode } from 'react';
import { parseProject, serializeProject } from '../persistence/serialize';
import { useProject } from '../store/project';
import { emptyProject } from '../types';

export default function ProjectActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const exportProject = async () => {
    const { project, planBlob } = useProject.getState();
    const json = await serializeProject(project, planBlob);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `assentador-de-piso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const { project, image } = await parseProject(await file.text());
      await useProject.getState().replaceProject(project, image);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Arquivo de projeto inválido.');
    }
  };

  const newProject = () => {
    if (!window.confirm('Começar um projeto novo? O projeto atual será apagado deste navegador.')) return;
    void useProject.getState().replaceProject(emptyProject(), null);
  };

  const menuRef = useRef<HTMLDetailsElement>(null);
  /** No celular as ações ficam num menu; ele fecha depois de escolher. */
  const act = (fn: () => void) => () => {
    if (menuRef.current) menuRef.current.open = false;
    fn();
  };
  const actions = (cls: string): ReactNode => (
    <>
      <button className={`btn ${cls} btn-quiet`} onClick={act(newProject)}>
        Novo projeto
      </button>
      <button className={`btn ${cls}`} onClick={act(() => inputRef.current?.click())}>
        Abrir projeto
      </button>
      <button className={`btn ${cls}`} onClick={act(() => void exportProject())}>
        Salvar arquivo
      </button>
    </>
  );

  return (
    <div className="topbar-actions">
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
      <div className="actions-inline">{actions('btn-sm')}</div>
      <details className="project-menu" ref={menuRef}>
        <summary className="btn btn-sm">Projeto</summary>
        <div className="project-menu-pop">{actions('')}</div>
      </details>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void importProject(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
