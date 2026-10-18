import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Lado maior da imagem gerada a partir do PDF. */
const PDF_TARGET_PX = 2400;

export interface RenderedImage {
  blob: Blob;
  width: number;
  height: number;
}

export type LoadedPlan =
  | ({ kind: 'image' } & RenderedImage)
  | { kind: 'pdf'; pageCount: number; render(page: number): Promise<RenderedImage> };

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'),
  );
}

export async function loadPlan(file: File): Promise<LoadedPlan> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf && !IMAGE_TYPES.includes(file.type)) {
    throw new Error('Formato não suportado. Use PDF, JPG ou PNG.');
  }

  if (!isPdf) {
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      throw new Error('Não foi possível abrir a imagem. O arquivo pode estar corrompido.');
    }
    const { width, height } = bmp;
    bmp.close();
    return { kind: 'image', blob: file, width, height };
  }

  let doc: pdfjs.PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new Error('Não foi possível abrir o PDF. O arquivo pode estar corrompido ou protegido.');
  }

  return {
    kind: 'pdf',
    pageCount: doc.numPages,
    async render(pageNumber: number) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PDF_TARGET_PX / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      return { blob: await canvasToBlob(canvas), width: canvas.width, height: canvas.height };
    },
  };
}
