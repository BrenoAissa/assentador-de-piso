// Renderiza as páginas de um PDF em PNG como o app faz (lado maior ≈ 2400 px, fundo branco).
// Uso: node scripts/render-pdf.mjs <arquivo.pdf> <pasta-de-saída>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';

const [, , input, outDir] = process.argv;
const doc = await getDocument({ data: new Uint8Array(readFileSync(input)) }).promise;
console.log(`páginas: ${doc.numPages}`);
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 2400 / Math.max(base.width, base.height) });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const file = join(outDir, `pagina-${n}.png`);
  writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`${file} ${canvas.width}×${canvas.height} (página ${base.width.toFixed(0)}×${base.height.toFixed(0)} pt)`);
}
