// Gera public/exemplo-planta.png: apartamento de 10 × 8 m a 2 px/cm, com paredes cheias,
// vãos de porta com arco, janelas e móveis em traço fino. Uso: node scripts/make-sample-plan.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const S = 2; // px por cm
const M = 100; // margem em px
const W = 1000 * S + 2 * M;
const H = 800 * S + 2 * M;
const img = new Uint8Array(W * H).fill(255);

const px = (cm) => Math.round(cm * S + M);
function fill(x0, y0, x1, y1, v = 30) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) img[y * W + x] = v;
}
/** Parede de (x0,y0) a (x1,y1) em cm, espessura t em cm, centrada na linha. */
function wall(x0, y0, x1, y1, t) {
  const h = (t * S) / 2;
  fill(Math.round(px(Math.min(x0, x1)) - h), Math.round(px(Math.min(y0, y1)) - h), Math.round(px(Math.max(x0, x1)) + h), Math.round(px(Math.max(y0, y1)) + h));
}
function clear(x0, y0, x1, y1) {
  fill(px(x0), px(y0), px(x1), px(y1), 255);
}
function line(x0, y0, x1, y1, v = 90) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * S);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(px(x0 + ((x1 - x0) * i) / n));
    const y = Math.round(px(y0 + ((y1 - y0) * i) / n));
    if (x >= 0 && y >= 0 && x < W && y < H) img[y * W + x] = v;
  }
}
function rect(x, y, w, h) {
  line(x, y, x + w, y);
  line(x + w, y, x + w, y + h);
  line(x + w, y + h, x, y + h);
  line(x, y + h, x, y);
}
function arc(cx, cy, r, a0, a1) {
  const n = Math.ceil(r * S * Math.abs(a1 - a0));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = Math.round(px(cx + r * Math.cos(a)));
    const y = Math.round(px(cy + r * Math.sin(a)));
    img[y * W + x] = 90;
  }
}

// paredes externas (15 cm)
wall(0, 0, 1000, 0, 15);
wall(1000, 0, 1000, 800, 15);
wall(1000, 800, 0, 800, 15);
wall(0, 800, 0, 0, 15);
// paredes internas (10 cm)
wall(550, 0, 550, 450, 10); // sala | cozinha
wall(550, 300, 1000, 300, 10); // cozinha | área de serviço
wall(0, 450, 1000, 450, 10); // linha sala/corredor
wall(0, 560, 600, 560, 10); // corredor | quartos
wall(400, 560, 400, 800, 10); // quarto 1 | banho
wall(600, 450, 600, 800, 10); // banho/corredor | suíte

// vãos de porta (80 cm) com arco
clear(545, 120, 556, 200); arc(550, 120, 80, Math.PI / 2, Math.PI); // sala → cozinha
clear(700, 295, 780, 306); arc(700, 300, 80, 0, Math.PI / 2); // cozinha → área
clear(200, 445, 280, 456); // sala → corredor (passagem sem porta)
clear(100, 555, 180, 566); arc(100, 560, 80, 0, Math.PI / 2); // corredor → quarto 1
clear(450, 555, 530, 566); arc(450, 560, 80, 0, Math.PI / 2); // corredor → banho
clear(595, 470, 606, 550); arc(600, 470, 80, 0, Math.PI / 2); // corredor → suíte

// janelas (vão na parede externa com 3 linhas finas)
for (const [x0, x1] of [[150, 400], [700, 900]]) {
  clear(x0, -8, x1, 8);
  for (const d of [-7, 0, 7]) line(x0, d, x1, d);
}
clear(-8, 600, 8, 720);
for (const d of [-7, 0, 7]) line(d, 600, d, 720);

// móveis em traço fino
rect(40, 300, 220, 90); // sofá
rect(330, 140, 120, 120); // mesa
rect(80, 620, 160, 170); // cama quarto 1
rect(720, 560, 200, 220); // cama suíte
rect(560, 10, 430, 60); // bancada cozinha
rect(420, 700, 60, 90); // box banho

// PNG em tons de cinza
const raw = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W + 1)] = 0;
  Buffer.from(img.buffer, y * W, W).copy(raw, y * (W + 1) + 1);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bits
ihdr[9] = 0; // tons de cinza
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('public', { recursive: true });
writeFileSync('public/exemplo-planta.png', png);
console.log(`public/exemplo-planta.png ${W}×${H}`);
