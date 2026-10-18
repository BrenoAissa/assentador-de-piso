# Paginador de Piso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web local que lê a planta (PDF/imagem), identifica os cômodos e mostra em 2D/3D a
paginação do piso com recortes, filetes, sobras reaproveitadas e caixas a comprar.

**Architecture:** SPA Vite + React + TS sem backend. O núcleo são dois conjuntos de funções puras
testadas com Vitest: `tiling/` (motor do quebra-cabeça) e `detection/` (visão computacional
sobre máscaras binárias). A UI (React + zustand) só orquestra; cálculo pesado roda em Web Workers.

**Tech Stack:** vite ^7, @vitejs/plugin-react ^5, react/react-dom ^19.1, typescript ~5.9,
vitest ^3, three 0.180.0 + @types/three 0.180.0, @react-three/fiber ^9.3, @react-three/drei
^10.7, zustand ^5, polygon-clipping ^0.15.7, pdfjs-dist ^5, tesseract.js ^6, idb-keyval ^6.

**Spec:** `docs/superpowers/specs/2026-10-18-paginador-piso-design.md`

## Global Constraints

- Unidade interna: cm. Planta: origem no canto superior esquerdo, `y` para baixo. 3D: `x→x`, `y→z`.
- Cômodos guardados em px da imagem original; `cm = px / pxPerCm`.
- Padrões: peça 60×60, rejunte 2 mm, 4 peças/caixa, perda 10%, reta, amarração 1/2, 0°,
  grade global, origem auto, `minCutCm = 5`, `minCutFraction = 1/3`, `kerfCm = 0.3`.
- Filete: dimensão reduzida < `max(minCutCm, minCutFraction · lado)`.
- Inteira: área ≥ 99,5% da peça. Interseção < 0,5 cm² é descartada.
- Amarração: `d = fração · px` (passo com rejunte) ou valor em cm.
- Sobra usada no máximo uma vez; só recortes `straight` participam.
- Detecção: lado maior ≤ 1600 px; abertura com quadrado `ceil(0.6·t)`; vãos `D = 20·t`
  (× sensibilidade); preenchimento mantido só se espessura ≤ `1.5·t`; descartar área < `(8·t)²`;
  DP com `ε = t/2`; ortogonalizar até ±5°; fallback de contorno se paredes < 2% dos pixels.
- Escala: estimativa por medidas válida se as duas concordam em 8%; `scale-mismatch` se > 10% da mediana.
- Toda a interface em português do Brasil, com acentuação correta.
- Cores: inteira cinza, recortada azul, filete vermelho, de sobra azul com borda tracejada.

## Review Focus

1. Cômodo com parede inclinada (não alinhada aos eixos): nenhuma peça fora do polígono e
   classificação `shaped` — teste no Task 2 (`engine.test.ts › parede inclinada`).
2. Escala trocada depois de calcular: resultado tem de ser recalculado, não reaproveitado —
   o resultado é derivado no store a partir de `project` (Task 4 invalida `result` em toda mudança).
3. Peça maior que o cômodo (ex.: régua 120 num lavabo de 90): só recortes, sem crash —
   teste no Task 2 (`engine.test.ts › peça maior que o cômodo`).
4. Polígono com vértices duplicados/colineares vindo do editor: área e clipping corretos —
   teste no Task 1 (`polygon.test.ts › vértices duplicados`).
5. Planta sem nenhuma cota legível: detecção devolve `scale = null` sem lançar erro —
   teste no Task 6 (`scale.test.ts › sem estimativas`).

---

### Task 1: Base do projeto e geometria

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder), `.gitignore`
- Create: `src/geometry/types.ts`, `src/geometry/polygon.ts`
- Test: `src/geometry/polygon.test.ts`

**Interfaces — Produces:**
```ts
// types.ts
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Ring = Point[];            // aberto (último ≠ primeiro)
// polygon.ts
signedArea(ring: Ring): number; polygonArea(ring: Ring): number;
bbox(rings: Ring | Ring[]): Rect;
isAxisRect(ring: Ring, eps?: number): boolean;     // 4 cantos efetivos, lados alinhados
pointInPolygon(p: Point, ring: Ring): boolean;
isSimple(ring: Ring): boolean;                     // ≥3 pontos distintos, sem autointerseção
cleanRing(ring: Ring, eps?: number): Ring;          // remove duplicados e colineares
swapXY(ring: Ring): Ring; scaleRing(ring: Ring, k: number): Ring;
```

- [ ] Step 1: `git init`, criar config (Vite + React + Vitest, `test.environment = 'node'`), `npm install`.
- [ ] Step 2: Testes: área do quadrado 300×300 = 90000; `bbox` de anel em L; `isAxisRect` true para retângulo com ponto colinear extra, false para L; `pointInPolygon` no L (dentro/fora do recorte); `isSimple` false para "gravata borboleta"; **vértices duplicados**: `polygonArea(cleanRing([...com duplicados]))` igual ao limpo.
- [ ] Step 3: Rodar `npx vitest run src/geometry` → FAIL.
- [ ] Step 4: Implementar.
- [ ] Step 5: `npx vitest run src/geometry` → PASS. Commit `feat: base do projeto e geometria`.

### Task 2: Motor de paginação

**Files:**
- Create: `src/tiling/types.ts`, `grid.ts`, `clip.ts`, `classify.ts`, `leftovers.ts`, `count.ts`, `engine.ts`, `optimize.ts`, `compare.ts`
- Test: `src/tiling/grid.test.ts`, `classify.test.ts`, `leftovers.test.ts`, `engine.test.ts`, `optimize.test.ts`

**Interfaces — Produces:**
```ts
// types.ts — TileSpec, LayoutSpec, Piece, LayoutResult exatamente como no spec §4, mais:
export interface RoomCm { id: string; name: string; ring: Ring; origin?: Point }
// LayoutResult ganha: roomOrigins: Record<string, Point>
export const DEFAULT_TILE: TileSpec; export const DEFAULT_LAYOUT: LayoutSpec;
// grid.ts (referencial da paginação: comprimento em x)
pitch(tile): { L: number; W: number; joint: number; px: number; py: number };
rowShift(r: number, layout: LayoutSpec, px: number): number;
tileRects(bounds: Rect, origin: Point, tile, layout): Array<{ r: number; c: number; rect: Rect }>;
// clip.ts
clipRectToRing(rect: Rect, ring: Ring): Ring[];     // anéis externos disjuntos
// classify.ts
classify(shape: Ring[], rect: Rect, L: number, W: number, layout): Pick<Piece,'kind'|'cutType'|'cutSize'>;
// leftovers.ts (referencial da paginação)
assignLeftovers(pieces: Piece[], L: number, W: number, layout): void;  // preenche fromLeftoverOf
// count.ts
summarize(pieces: Piece[], tile: TileSpec, floorAreaCm2: number): LayoutResult['summary'];
// engine.ts
computeLayout(rooms: RoomCm[], tile, layout, origins: Record<string, Point>): LayoutResult;
solveLayout(rooms: RoomCm[], tile, layout): LayoutResult;   // resolve 'auto' e modo perRoom
// optimize.ts
fastScore(rooms: RoomCm[], tile, layout, origin: Point): number;  // só arestas alinhadas
optimizeOrigin(rooms: RoomCm[], tile, layout): Point;             // 2 fases, top 20
compareResults(a: LayoutResult, b: LayoutResult): number;          // filetes → compra → recortes
// compare.ts
comparePatterns(rooms, tile, layout): Array<{ label: string; layout: LayoutSpec; result: LayoutResult }>;
```

Pipeline de `computeLayout`: se `rotationDeg = 90`, `swapXY` nos anéis e origens → gerar,
recortar e classificar por cômodo → `assignLeftovers` → numerar (cômodo na ordem da lista,
fileira `r`, depois `c`) → destrocar `tileRect`, `shape` e `cutSize`. `origins[roomId]` vem
de `solveLayout`: no modo global todos recebem a mesma origem.

`fastScore`: para cada aresta vertical alinhada em `X` (lado interno conhecido pela orientação
do anel), para cada fileira que ela cruza, `t = mod(X − ox − shift(r), px)`. Interior à
esquerda → recorte = `t` se `0 < t < L`. Interior à direita → recorte = `L − t` se `0 < t < L`.
Arestas horizontais: o mesmo com `oy`, `py` e `W`, multiplicado pelo número de peças ao longo
da aresta. Pontuação = `1000·filetes + recortes`.

Desempate de centralização: `|recorte esquerdo − recorte direito| + |topo − base|` na caixa
envolvente.

- [ ] Step 1: Testes (`engine.test.ts`): 300×300, peça 60×60, rejunte 0, origem (0,0) → 25 inteiras, 0 recortes; com rejunte 2 mm na origem (0,0) → `cutSize` das peças da última coluna = `300 − 4·60,2 = 59,2` (inteira não, pois 59,2 < 60) e contagem 25; 310×300 com `solveLayout` → `slivers = 0` e nenhum `cutSize.w < 20`; cômodo em L → todas as peças com `bbox` dentro do L e pelo menos uma `corner` ou `shaped`; **parede inclinada** (trapézio) → nenhuma peça fora do polígono (área de cada `shape` ≤ área do retângulo e centroide dentro) e pelo menos uma `shaped`; rotação 90 em 200×300 com peça 20×120 equivale ao 300×200 a 0° transposto (mesma contagem); **peça maior que o cômodo**: 90×150 com 20×120 → só recortes, sem exceção; soma das áreas das peças = área do cômodo − rejunte (tolerância 1%).
- [ ] Step 2: Testes (`grid.test.ts`): `rowShift` com 1/2 alterna 0, px/2; com 1/3 repete a cada 3 fileiras exatamente; `tileRects` cobre a caixa (união contém os 4 cantos).
- [ ] Step 3: Testes (`classify.test.ts`): inteira; recorte reto em x de 35 cm → `straight`, `cutSize {w:35,h:60}`; recorte de 10 cm → `sliver`; canto → `corner`.
- [ ] Step 4: Testes (`leftovers.test.ts`): recortes de 70 e 45 numa régua de 120 → o de 45 sai da sobra do de 70 (`120 − 70 − 0,3 = 49,7 ≥ 45`); a mesma sobra não é usada duas vezes; sobra que seria filete não entra no estoque.
- [ ] Step 5: Testes (`optimize.test.ts`): `optimizeOrigin` em 310×300 → resultado sem filetes; `compareResults` ordena por filetes antes de compra.
- [ ] Step 6: Testes de contagem dentro de `engine.test.ts`: 25 peças novas, perda 10%, 4/caixa → `tilesToBuy = 28`, `boxes = 7`.
- [ ] Step 7: `npx vitest run src/tiling` → FAIL. Implementar. → PASS. Commit `feat: motor de paginação`.

### Task 3: Tipos do projeto, store, persistência e entrada

**Files:**
- Create: `src/types.ts`, `src/store/project.ts`, `src/store/issues.ts`, `src/persistence/db.ts`, `src/input/loadPlan.ts`
- Test: `src/store/issues.test.ts`, `src/persistence/serialize.test.ts` (com `src/persistence/serialize.ts`)

**Interfaces — Produces:**
```ts
// types.ts: Project, PlanImage, Scale, Room, RoomIssue (spec §4); re-exporta TileSpec/LayoutSpec
// store/project.ts — zustand
useProject: { project; step: 1|2|3|4; planUrl: string|null; selectedRoomId: string|null;
  setPlan(blob: Blob, meta: Omit<PlanImage,'imageId'>): Promise<void>; setScale(s: Scale|null);
  setRooms(r: Room[]); addRoom(r: Room); updateRoom(id, patch: Partial<Room>); removeRoom(id);
  setTile(patch); setLayout(patch); setStep(s); selectRoom(id|null); loadFromStorage(): Promise<void>;
  replaceProject(p: Project, image: Blob|null): Promise<void> }
roomsInCm(project: Project): RoomCm[];               // só receivesTile e sem invalid-polygon
canAdvance(project: Project, step): { ok: boolean; reason?: string };
// store/issues.ts
computeIssues(room: Room, extra?: RoomIssue[]): RoomIssue[];  // invalid-polygon, unnamed, low-confidence (<0.6)
// persistence
saveProject(p), loadProject(), saveImage(id, blob), loadImage(id);  // idb-keyval
serializeProject(p: Project, image: Blob|null): Promise<string>; parseProject(json): Promise<{project; image}>;
// input/loadPlan.ts
loadPlan(file: File): Promise<{ kind:'image'; blob; width; height } | { kind:'pdf'; pageCount; render(page: number): Promise<{ blob; width; height }> }>;
```
PDF renderizado com o lado maior ≈ 2400 px; worker do pdf.js via `?url`.

- [ ] Step 1: Testes: `computeIssues` (polígono de 2 pontos → `invalid-polygon`; nome vazio → `unnamed`; confiança 0,4 → `low-confidence`); `canAdvance` passo 2 sem escala → `ok:false` com motivo; ida e volta `serializeProject`/`parseProject` preserva projeto e bytes da imagem.
- [ ] Step 2: FAIL → implementar → PASS. Commit `feat: store, persistência e entrada`.

### Task 4: Shell da UI, passo 1 e editor (passo 2)

**Files:**
- Create: `src/App.tsx`, `src/ui/Stepper.tsx`, `src/ui/StepUpload.tsx`, `src/ui/app.css`
- Create: `src/editor/PlanEditor.tsx`, `src/editor/RoomPanel.tsx`, `src/editor/ops.ts`
- Test: `src/editor/ops.test.ts`

**Interfaces — Produces:**
```ts
// editor/ops.ts
insertVertex(ring: Ring, edgeIndex: number, p: Point): Ring;
removeVertex(ring: Ring, i: number): Ring;                 // nunca abaixo de 3 vértices
nearestEdge(ring: Ring, p: Point): { index: number; dist: number; foot: Point };
calibrationScale(a: Point, b: Point, cm: number): number;   // px/cm
roomSizeLabel(ring: Ring, pxPerCm: number): string;         // "3,20 × 4,50 m · 14,4 m²"
```
Ferramentas: selecionar/arrastar vértice, duplo clique na aresta insere, Delete remove,
"Novo cômodo" (clicar cantos, fechar no primeiro ponto ou Enter), "Calibrar" (2 cliques + cm),
excluir cômodo, zoom (roda) e pan (arrastar fundo). Painel: lista com nome editável,
"recebe piso", medidas, pendências e botão "Detectar de novo" (sensibilidade 0,5–2).
Qualquer mudança em `project` zera `result` (Review Focus 2). Autosave com debounce de 1 s.

- [ ] Step 1: Testes de `ops.ts` (inserir no meio da aresta 1; remover não baixa de 3; aresta mais próxima; 300 px para 150 cm → 2 px/cm; rótulo com vírgula decimal).
- [ ] Step 2: FAIL → implementar `ops.ts` → PASS.
- [ ] Step 3: Implementar componentes; `npm run build` sem erros de tipo.
- [ ] Step 4: Commit `feat: upload e editor de cômodos`.

### Task 5: Passo 3 (piso) e passo 4 (2D, recortes, comparativo, impressão)

**Files:**
- Create: `src/ui/TileForm.tsx`, `src/ui/validate.ts`, `src/tiling/worker.ts`, `src/tiling/client.ts`
- Create: `src/report/Plan2D.tsx`, `src/report/CutTable.tsx`, `src/report/Summary.tsx`, `src/report/Compare.tsx`, `src/ui/StepResult.tsx`, `src/report/print.css`
- Test: `src/ui/validate.test.ts`

**Interfaces — Produces:**
```ts
validateTile(tile: TileSpec, layout: LayoutSpec): string[];  // mensagens em pt-BR
// tiling/client.ts
solveInWorker(rooms: RoomCm[], tile, layout): Promise<LayoutResult>;
compareInWorker(rooms, tile, layout): Promise<ReturnType<typeof comparePatterns>>;
```
`Plan2D` (SVG em cm): peças coloridas, número no centro, medida nos recortes, paredes em
contorno; arrastar com o modo global ativo muda `layout.origin` (desliga auto); botão
"Otimizar de novo" volta para `'auto'`. Imprimir = `window.print()` com `print.css`
(só planta, tabela e resumo).

- [ ] Step 1: Testes de `validateTile` (medida ≤ 0, rejunte negativo, peças/caixa < 1, perda fora de 0–50 → mensagens; caso válido → `[]`).
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: Implementar worker, cliente e componentes; `npm run build` OK.
- [ ] Step 4: Commit `feat: passo do piso e resultado 2D`.

### Task 6: Visualização 3D

**Files:**
- Create: `src/viewer3d/Scene.tsx`, `src/viewer3d/geometry.ts`
- Test: `src/viewer3d/geometry.test.ts`

**Interfaces — Produces:**
```ts
ringsToShapes(rings: Ring[]): THREE.Shape[];            // y da planta vira -y do Shape (rotacionado para o chão)
wallSegments(ring: Ring, thickness: number): Array<{ cx: number; cz: number; length: number; angle: number }>; // por fora do cômodo
```
Cena em cm dentro de um grupo com escala 0,01. Peças com `ExtrudeGeometry` (1 cm), plano
escuro de rejunte, paredes de 10 × 100 cm semitransparentes, `OrbitControls`, clique destaca
a peça e mostra o painel. Acima de 3.000 peças, as inteiras usam `InstancedMesh`.

- [ ] Step 1: Testes: `wallSegments` de quadrado 100×100 → 4 segmentos de comprimento 100 com centros a 5 cm para fora; `ringsToShapes` preserva número de pontos.
- [ ] Step 2: FAIL → implementar → PASS. Integrar na aba 3D; `npm run build` OK. Commit `feat: visualização 3D`.

### Task 7: Detecção automática

**Files:**
- Create: `src/detection/types.ts`, `binarize.ts`, `morphology.ts`, `thickness.ts`, `outline.ts`, `gaps.ts`, `components.ts`, `contour.ts`, `simplify.ts`, `pipeline.ts`, `ocrParse.ts`, `ocr.ts`, `scale.ts`, `worker.ts`, `index.ts`
- Test: `src/detection/synthetic.ts` (helper), `pipeline.test.ts`, `morphology.test.ts`, `ocrParse.test.ts`, `scale.test.ts`, `simplify.test.ts`

**Interfaces — Produces:**
```ts
type Mask = { w: number; h: number; data: Uint8Array };   // 1 = tinta/parede
toGray(img: { width; height; data: Uint8ClampedArray }): { w; h; data: Uint8Array };
otsu(gray): number; binarize(gray, t): Mask;
erode(m: Mask, kw: number, kh: number): Mask; dilate(...); open(m, k): Mask;   // prefix sums
estimateWallThickness(m: Mask): number;
distanceTransform(m: Mask, target: 0|1): Float32Array; fillOutlineWalls(m: Mask): Mask;
closeGaps(walls: Mask, t: number, D: number): Mask;
labelComponents(m: Mask, target: 0|1): { labels: Int32Array; stats: Array<{ area; minX; minY; maxX; maxY; touchesBorder }> };
fillHoles(region: Mask): Mask;
traceContour(region: Mask): Ring;                // contorno pelos cantos dos pixels
douglasPeucker(r: Ring, eps): Ring; orthogonalize(r: Ring, maxDeg = 5): Ring;
detectRooms(img, opts: { sensitivity?: number; mode?: 'auto'|'filled'|'outline' }):
  { rooms: Array<{ polygonPx: Ring; confidence: number }>; wallThicknessPx: number; mode: 'filled'|'outline'; warnings: string[] };
parseDims(s): { a: number; b: number } | null; parseArea(s): number | null; matchRoomName(s): string | null;
runOcr(source: Blob, onProgress?): Promise<Array<{ text: string; bbox: Rect }>>;
estimateScale(rooms: Array<{ polygonPx: Ring; dims?; areaM2? }>): { scale: Scale | null; mismatched: number[] };
detectPlan(blob: Blob, opts, onProgress): Promise<DetectionResult>;  // spec §6.4, coordenadas da imagem original
```
`synthetic.ts` desenha plantas em `Mask`: `rectWall(m, x, y, w, h, t)`, `clearRect` (vão), `line` (traço fino).

- [ ] Step 1: Testes: `open` remove linha de 1 px e mantém parede de 10 px; planta com 3 cômodos retangulares e parede de 10 px → 3 polígonos com cantos certos (±2 px); com vão de porta de 80 px → continua 3 cômodos; corredor de 30 px entre paredes paralelas não é fechado; traços finos não viram parede; cômodo em L → 6 vértices; `parseDims('3,20 x 4,50')`, `'3.2X4.5'`, `parseArea('12,5 m²')`, `'12,50m2'`, `matchRoomName('DORM. 1')`; `estimateScale` coerente → mediana correta, discrepante → índice em `mismatched`, **sem estimativas** → `scale = null`.
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: Integrar no passo 1 → 2 (progresso, pendências, "Detectar de novo"); `npm run build` OK. Commit `feat: detecção automática`.

### Task 8: Verificação no navegador

- [ ] Step 1: `npx vitest run` → todos PASS; `npm run build` OK.
- [ ] Step 2: Subir `npm run dev` pelo preview e percorrer: upload de planta sintética (gerada e salva em `public/exemplo-planta.png`), detecção, ajuste de vértice, calibração, piso, 2D, 3D, comparativo, recarregar página (persistência).
- [ ] Step 3: Corrigir o que aparecer; commit `chore: ajustes de verificação`.
