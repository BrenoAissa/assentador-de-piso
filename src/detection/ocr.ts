import { createWorker, PSM } from 'tesseract.js';
import type { Rect } from '../geometry/types';

export interface OcrWord {
  text: string;
  bbox: Rect;
  confidence: number;
}

export interface OcrLine {
  text: string;
  bbox: Rect;
  /** Lida na passada girada: texto vertical na planta (cotas verticais). */
  vertical: boolean;
  words: OcrWord[];
}

/** Lado maior da região ampliada para o OCR: cotas miúdas precisam de uns 30 px de altura. */
const OCR_TARGET_PX = 2600;
const MAX_UPSCALE = 4;

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Linhas e palavras de texto da região da planta, com caixas em px da imagem original.
 * A região é ampliada e lida duas vezes: normal e girada 90° (para as cotas verticais).
 */
export async function runOcr(source: Blob, region: Rect | null, onProgress?: (p: number) => void): Promise<OcrLine[]> {
  const bmp = await createImageBitmap(source);
  const r = region ?? { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const k = Math.min(MAX_UPSCALE, Math.max(1, OCR_TARGET_PX / Math.max(r.w, r.h)));
  const W = Math.round(r.w * k);
  const H = Math.round(r.h * k);

  const draw = (vertical: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = vertical ? H : W;
    canvas.height = vertical ? W : H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (vertical) {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, W, H);
    return canvas;
  };

  // caixa na imagem lida → caixa na imagem original
  const toOriginal = (b: Box, vertical: boolean): Rect => {
    // na passada girada, (u, v) da tela = (H − sy, sx) do recorte ampliado
    const sx0 = vertical ? b.y0 : b.x0;
    const sx1 = vertical ? b.y1 : b.x1;
    const sy0 = vertical ? H - b.x1 : b.y0;
    const sy1 = vertical ? H - b.x0 : b.y1;
    return { x: r.x + sx0 / k, y: r.y + sy0 / k, w: (sx1 - sx0) / k, h: (sy1 - sy0) / k };
  };

  let pass = 0;
  const worker = await createWorker('por', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.((pass + m.progress) / 2);
    },
  });
  const lines: OcrLine[] = [];
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    for (const vertical of [false, true]) {
      const { data } = await worker.recognize(draw(vertical), {}, { blocks: true });
      for (const block of data.blocks ?? []) {
        for (const par of block.paragraphs) {
          for (const line of par.lines) {
            const text = line.text.trim();
            if (!text) continue;
            lines.push({
              text,
              bbox: toOriginal(line.bbox, vertical),
              vertical,
              words: line.words.map((w) => ({ text: w.text, bbox: toOriginal(w.bbox, vertical), confidence: w.confidence })),
            });
          }
        }
      }
      pass++;
    }
  } finally {
    bmp.close();
    await worker.terminate();
  }
  return lines;
}
