import { bbox, pointInPolygon } from '../geometry/polygon';
import type { Rect } from '../geometry/types';
import { runOcr, type OcrLine } from './ocr';
import { matchRoomName, parseArea, parseDims, parseLinear } from './ocrParse';
import { estimateScale } from './scale';
import type { CvResult, DetectedRoom, DetectionResult, DetectOptions, RGBAImage } from './types';

/** Lado maior da imagem usada na visão computacional. */
const CV_MAX_PX = 1600;

let nextId = 1;

function runCv(image: RGBAImage, opts: DetectOptions): Promise<CvResult> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const id = nextId++;
  return new Promise<CvResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: CvResult; error?: string }>) => {
      if (e.data.id !== id) return;
      worker.terminate();
      if (e.data.ok) resolve(e.data.result!);
      else reject(new Error(e.data.error ?? 'Falha na detecção.'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Falha na detecção.'));
    };
    worker.postMessage({ id, image, opts }, [image.data.buffer]);
  });
}

/** Confiança mínima (0–100) para aceitar uma cota lida pelo OCR. */
const MIN_DIM_CONFIDENCE = 60;

const center = (b: Rect) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Associa nomes, medidas, áreas e cotas lineares ao cômodo que contém o centro do texto. */
function assignText(rooms: DetectedRoom[], lines: OcrLine[]): void {
  const roomAt = (b: Rect) => rooms.find((r) => pointInPolygon(center(b), r.polygonPx));
  for (const line of lines) {
    const room = roomAt(line.bbox);
    if (room) {
      room.name ??= matchRoomName(line.text) ?? undefined;
      room.dims ??= parseDims(line.text) ?? undefined;
      room.areaM2 ??= parseArea(line.text) ?? undefined;
    }
    for (const word of line.words) {
      const value = word.confidence >= MIN_DIM_CONFIDENCE ? parseLinear(word.text) : null;
      const target = value !== null ? roomAt(word.bbox) : undefined;
      if (value !== null && target) (target.linear ??= []).push({ valueM: value, vertical: line.vertical });
    }
  }
}

/** Região dos cômodos com uma margem, para o OCR não ler logotipos e assinaturas. */
function textRegion(rooms: DetectedRoom[], width: number, height: number): Rect {
  const b = bbox(rooms.map((r) => r.polygonPx));
  const m = 0.04 * Math.max(b.w, b.h);
  const x = Math.max(0, b.x - m);
  const y = Math.max(0, b.y - m);
  return { x, y, w: Math.min(width, b.x + b.w + m) - x, h: Math.min(height, b.y + b.h + m) - y };
}

export type DetectProgress = (stage: string, progress?: number) => void;

/** Planta (imagem) → cômodos em px da imagem original, nomes, medidas e escala. */
export async function detectPlan(blob: Blob, opts: DetectOptions, onProgress: DetectProgress): Promise<DetectionResult> {
  onProgress('Preparando a imagem');
  const bmp = await createImageBitmap(blob);
  const { width: imgW, height: imgH } = bmp;
  const f = Math.min(1, CV_MAX_PX / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * f);
  const h = Math.round(bmp.height * f);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const pixels = ctx.getImageData(0, 0, w, h);

  onProgress('Procurando as paredes');
  const cv = await runCv({ width: w, height: h, data: pixels.data }, opts);
  const rooms: DetectedRoom[] = cv.rooms.map((r) => ({
    ...r,
    polygonPx: r.polygonPx.map((p) => ({ x: p.x / f, y: p.y / f })),
  }));
  const warnings = [...cv.warnings];

  if (rooms.length > 0) {
    try {
      onProgress('Lendo nomes e medidas', 0);
      const region = textRegion(rooms, imgW, imgH);
      assignText(rooms, await runOcr(blob, region, (p) => onProgress('Lendo nomes e medidas', p)));
    } catch {
      warnings.push('Não consegui ler os textos da planta. Dê nome aos cômodos e calibre a escala à mão.');
    }
  }

  const { scale, mismatched } = estimateScale(rooms);
  for (const i of mismatched) rooms[i].scaleMismatch = true;
  for (const r of rooms) if (r.dims || r.areaM2 || r.linear) r.confidence = Math.min(1, r.confidence + 0.1);
  if (!scale && rooms.length > 0) warnings.push('Não achei cotas legíveis para calcular a escala. Use "Calibrar escala".');

  return { rooms, scale, wallThicknessPx: cv.wallThicknessPx / f, mode: cv.mode, warnings };
}
