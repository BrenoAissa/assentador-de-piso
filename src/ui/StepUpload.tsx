import { useRef, useState } from 'react';
import { loadPlan, type LoadedPlan, type RenderedImage } from '../input/loadPlan';
import { useProject } from '../store/project';

interface Props {
  /** Chamado depois que a planta é salva; a detecção automática entra aqui. */
  onPlanReady?: (image: RenderedImage) => Promise<void> | void;
}

export default function StepUpload({ onPlanReady }: Props) {
  const hasPlan = useProject((s) => !!s.project.plan);
  const { setPlan, setStep, startDrawing } = useProject.getState();
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

  return (
    <div className="workspace single">
      <div
        className={`canvas dropzone${over ? ' over' : ''}`}
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
        <div className="dropzone-box">
          <h2>{hasPlan ? 'Trocar a planta' : 'Envie a planta do apartamento'}</h2>
          <p className="muted">
            Arraste o arquivo para cá ou escolha no computador. Aceita PDF, JPG ou PNG. A leitura é feita aqui no
            navegador; a planta não é enviada para nenhum servidor.
          </p>
          {hasPlan && <p className="muted">Trocar a planta apaga os cômodos marcados na atual.</p>}

          {pdf ? (
            <>
              <p>
                O PDF tem {pdf.doc.pageCount} páginas. Em qual está a planta?
              </p>
              <div className="page-list">
                {Array.from({ length: pdf.doc.pageCount }, (_, i) => (
                  <button key={i} className="btn btn-sm" disabled={!!busy} onClick={() => void choosePage(i + 1)}>
                    Página {i + 1}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={!!busy} onClick={() => inputRef.current?.click()}>
                Escolher arquivo
              </button>
              {hasPlan && (
                <button className="btn" onClick={() => setStep(2)}>
                  Manter a planta atual
                </button>
              )}
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
          {!pdf && (
            <div className="draw-instead">
              <p className="muted">Não tem a planta? Desenhe as paredes com as medidas da trena.</p>
              <button className="btn" disabled={!!busy} onClick={startDrawing}>
                Desenhar a planta
              </button>
            </div>
          )}
          {busy && <p className="muted" role="status">{busy}</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
