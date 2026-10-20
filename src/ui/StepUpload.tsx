import { useRef, useState } from 'react';
import { loadPlan, type LoadedPlan, type RenderedImage } from '../input/loadPlan';
import { isSample, sampleProject } from '../sample';
import { useProject } from '../store/project';
import HeroPlan from './HeroPlan';

interface Props {
  /** Chamado depois que a planta é salva; a detecção automática entra aqui. */
  onPlanReady?: (image: RenderedImage) => Promise<void> | void;
}

export default function StepUpload({ onPlanReady }: Props) {
  const hasPlan = useProject((s) => !!s.project.plan);
  const { setPlan, setStep, startDrawing, replaceProject } = useProject.getState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ name: string; doc: Extract<LoadedPlan, { kind: 'pdf' }> } | null>(null);

  const usePlan = async (img: RenderedImage, sourceName: string, pdfPage?: number) => {
    setBusy('Salvando a planta…');
    await setPlan(img.blob, { widthPx: img.width, heightPx: img.height, sourceName, ...(pdfPage ? { pdfPage } : {}) });
    setBusy(null);
    setStep(2);
    await onPlanReady?.(img);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPdf(null);
    setBusy('Abrindo o arquivo…');
    try {
      const loaded = await loadPlan(file);
      if (loaded.kind === 'image') return await usePlan(loaded, file.name);
      if (loaded.pageCount === 1) {
        setBusy('Convertendo o PDF…');
        return await usePlan(await loaded.render(1), file.name, 1);
      }
      setPdf({ name: file.name, doc: loaded });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.');
    }
  };

  const choosePage = async (page: number) => {
    if (!pdf) return;
    setBusy(`Convertendo a página ${page}…`);
    try {
      await usePlan(await pdf.doc.render(page), pdf.name, page);
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'Não foi possível converter a página.');
    }
  };

  const openSample = async () => {
    const { project } = useProject.getState();
    if (project.rooms.length > 0 && !isSample(project) && !window.confirm('Abrir o exemplo substitui o projeto que está neste navegador. Continuar?')) return;
    await replaceProject(sampleProject(), null);
    setStep(4);
  };

  return (
    <div
      className={`welcome${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
    >
      <section className="welcome-copy">
        <h1 className="welcome-title">Veja como o piso fica no seu apartamento antes de comprar</h1>
        <p className="welcome-lede">
          Desenhe a planta com as medidas da trena ou envie o PDF do apartamento. O app mostra cada recorte, onde caem
          os filetes e quantas caixas comprar, e deixa você montar do seu jeito.
        </p>

        {pdf ? (
          <div className="welcome-pdf">
            <p>
              O PDF tem {pdf.doc.pageCount} páginas. Em qual está a planta?
            </p>
            <div className="page-list">
              {Array.from({ length: pdf.doc.pageCount }, (_, i) => (
                <button key={i} className="btn" disabled={!!busy} onClick={() => void choosePage(i + 1)}>
                  Página {i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="welcome-actions">
            {hasPlan && (
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                Continuar meu projeto
              </button>
            )}
            <button className={`btn btn-lg${hasPlan ? '' : ' btn-primary'}`} disabled={!!busy} onClick={() => void openSample()}>
              Ver um apartamento de exemplo
            </button>
            <div className="welcome-pair">
              <button className="btn btn-lg" disabled={!!busy} onClick={startDrawing}>
                Desenhar minha planta
              </button>
              <button className="btn btn-lg" disabled={!!busy} onClick={() => inputRef.current?.click()}>
                Enviar a planta (PDF ou foto)
              </button>
            </div>
            {hasPlan && <p className="muted">Desenhar ou enviar outra planta apaga os cômodos do projeto atual.</p>}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {busy && (
          <p className="muted" role="status">
            {busy}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="welcome-note">
          Funciona no navegador do celular ou do computador. A planta fica no seu aparelho: nada é enviado para a
          internet.
        </p>
      </section>
      <HeroPlan />
    </div>
  );
}
