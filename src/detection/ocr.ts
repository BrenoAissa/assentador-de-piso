import { createWorker, PSM } from 'tesseract.js';
import type { Rect } from '../geometry/types';

export interface OcrLine {
  text: string;
  bbox: Rect;
}

/** Plantas pequenas são ampliadas 2× para o OCR enxergar cotas miúdas. */
const UPSCALE_BELOW = 2000;

/** Linhas de texto da planta, com caixas em px da imagem original. */
export async function runOcr(source: Blob, onProgress?: (p: number) => void): Promise<OcrLine[]> {
  const bmp = await createImageBitmap(source);
  const k = Math.max(bmp.width, bmp.height) < UPSCALE_BELOW ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width * k;
  canvas.height = bmp.height * k;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();

  const worker = await createWorker('por', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const lines: OcrLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const par of block.paragraphs) {
        for (const line of par.lines) {
          const text = line.text.trim();
          if (!text) continue;
          const b = line.bbox;
          lines.push({ text, bbox: { x: b.x0 / k, y: b.y0 / k, w: (b.x1 - b.x0) / k, h: (b.y1 - b.y0) / k } });
        }
      }
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}
