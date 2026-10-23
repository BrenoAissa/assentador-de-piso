# Pisos diferentes por cômodo: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o projeto passa a ter vários pisos (peça + layout), cada cômodo recebe um piso ou nenhum, cada piso é calculado e comprado separado, e um cômodo pode ser dividido em dois na divisa.

**Architecture:** `Project.tile`/`Project.layout` viram `Project.floors: Floor[]` (sempre ≥ 1); `Room.floorId` diz o piso (ausente ou desconhecido = primeiro piso; `receivesTile: false` = sem piso). O motor atual roda por piso (`solveLayout` com os cômodos daquele piso) e `mergeFloors` junta os resultados num `ProjectLayout` com numeração contínua e `floorId` em cada peça. As telas que só desenham peças passam a aceitar `{ pieces }`; as que dependem de peça/layout (montagem, resumo, compra, recortes, impressão) trabalham por piso.

**Tech Stack:** React 19 + TypeScript, zustand, Vitest, polygon-clipping (já instalado), worker de cálculo existente.

**Spec:** `docs/superpowers/specs/2026-10-23-pisos-por-comodo-design.md`

## Global Constraints

- Nome padrão do piso: `Piso {comprimento} × {largura} cm`, números em pt-BR sem casas desnecessárias (ex.: `Piso 83 × 83 cm`, `Piso 82,5 × 82,5 cm`).
- Com um piso só, as telas ficam como hoje (sem fichas, sem seletor de piso no cômodo; caixinha "Recebe este piso").
- Projetos salvos em arquivo (versão 1, `assentador-piso` ou `paginador-piso`) e no IndexedDB abrem com um piso igual ao que tinham, cômodos e ajustes mantidos.
- Sobra de um piso nunca é usada em outro piso.
- Numeração das peças contínua entre pisos (sem números repetidos na planta).
- Mudar peça/rejunte/encaixe/direção/grade de um piso desfaz só os ajustes manuais dos cômodos daquele piso; cômodo que troca de piso perde os seus ajustes; cômodo dividido perde ajustes, começo (`origin`) e entrada (`start`).
- Textos fixos: "+ Outro piso", "Cômodos com este piso", "Nenhum cômodo com este piso", "Sem piso", "Dividir cômodo", "Desfazer a divisão", e a dica da divisa: "Para peça inteira dos dois lados da divisa, marque a entrada encostada nela em cada piso."
- Dois pisos "se encostam" quando bordas de cômodos de pisos diferentes se sobrepõem com tolerância de 1 cm.
- Tudo funciona por toque e em tela estreita (padrões já usados: tocar = ação, arrastar = mover a vista).

## Review Focus

- Projeto antigo guardado no IndexedDB do celular (sem `floors`) abre com um piso: teste de `normalizeProject` na Task 1.
- Cômodo com `floorId` de um piso apagado cai no primeiro piso, sem sumir da conta: teste de `roomFloorId` na Task 1.
- Piso sem cômodos não entra no cálculo nem na compra e não impede avançar: teste de `floorInputs`/`canAdvance` na Task 2.
- Arrastar o piso de 85 não mexe em nenhuma peça do 83: teste de `replaceFloor` na Task 3.
- Linha de divisão que corta um cômodo em L em três pedaços é recusada: teste de `splitRing` na Task 5.

---

### Task 1: Pisos no modelo de dados e conversão dos projetos antigos

**Files:**
- Modify: `src/types.ts` (Floor, Project.floors, Room.floorId, normalizeProject, emptyProject)
- Create: `src/floors.ts` (helpers puros de pisos)
- Modify: `src/persistence/serialize.ts` (aceitar arquivo antigo e novo)
- Modify (consumidores de `project.tile/layout` que quebram na compilação): `src/sample.ts`, `src/sample.test.ts`, `src/ui/HeroPlan.tsx`, `scripts/make-og.ts`, `src/store/issues.test.ts`
- Test: `src/floors.test.ts`, `src/persistence/serialize.test.ts`

**Interfaces:**
- Produces:
  - `interface Floor { id: string; name: string; tile: TileSpec; layout: LayoutSpec }` (em `src/types.ts`)
  - `Project` sem `tile`/`layout`, com `floors: Floor[]`; `Room.floorId?: string`
  - `const FIRST_FLOOR_ID = 'piso-1'`
  - `floorName(tile: TileSpec): string`
  - `newFloor(id: string, tile?: TileSpec, layout?: LayoutSpec): Floor` (padrões `DEFAULT_TILE`/`DEFAULT_LAYOUT`, nome por `floorName`)
  - `roomFloorId(project: Project, room: Room): string | null`
  - `floorById(project: Project, id: string): Floor` (desconhecido → primeiro)
  - `normalizeProject(p)` converte `{ tile, layout }` antigo em `floors: [newFloor(FIRST_FLOOR_ID, tile, layout)]`

- [ ] **Step 1: Write the failing tests** (`src/floors.test.ts`)
  - `floorName({lengthCm: 83, widthCm: 83, ...})` → `'Piso 83 × 83 cm'`; `82.5 × 82.5` → `'Piso 82,5 × 82,5 cm'`; `120 × 20` → `'Piso 120 × 20 cm'`.
  - `normalizeProject` de um objeto antigo `{ version: 1, ..., tile: T83, layout: L, edits }` → `floors.length === 1`, `floors[0].tile` igual a `T83`, `floors[0].layout` igual a `L`, sem campos `tile`/`layout` no topo, `edits` preservado.
  - `normalizeProject` de projeto já com `floors` devolve os mesmos `floors`.
  - `roomFloorId`: sem `floorId` → `'piso-1'`; `floorId` de piso inexistente → `'piso-1'`; `floorId: 'piso-2'` existente → `'piso-2'`; `receivesTile: false` → `null`.
  - `serialize.test.ts`: arquivo antigo (`app: 'paginador-piso'`, `project` com `tile`/`layout`) abre com `floors[0].tile` igual ao `tile` do arquivo.
- [ ] **Step 2: Run** `npx vitest run src/floors.test.ts src/persistence/serialize.test.ts` → FAIL (módulo/função inexistente).
- [ ] **Step 3: Implement** os tipos e helpers acima; `parseProject` valida `Array.isArray(p.rooms)` e (`p.floors` não vazio ou `p.tile && p.layout`) e devolve `normalizeProject(p)`. Atualize `sample.ts` (usa `emptyProject().floors`), `HeroPlan.tsx`/`make-og.ts`/`sample.test.ts` (usam `project.floors[0].tile/layout`), `issues.test.ts` (`p.floors[0].tile.lengthCm = 0`).
- [ ] **Step 4: Run** `npx vitest run` e `npx tsc -b` → os testes novos passam; erros de compilação restantes só nos arquivos das Tasks 2 a 6 (aceitável até lá; nenhum teste antigo quebrado).
- [ ] **Step 5: Commit** `feat: pisos no modelo de dados (projetos antigos viram um piso)`

### Task 2: Store por piso e entradas do cálculo

**Files:**
- Modify: `src/floors.ts` (operações puras sobre o projeto)
- Modify: `src/store/edits.ts` (`dropRoomEdits`, `start` já está em GRID_FIELDS)
- Modify: `src/store/issues.ts` (`floorInputs`, `canAdvance` por piso)
- Modify: `src/store/project.ts` (ações por piso, histórico com `floors`)
- Test: `src/floors.test.ts`, `src/store/edits.test.ts`, `src/store/issues.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Floor`, `newFloor`, `roomFloorId`, `floorById`, `FIRST_FLOOR_ID`).
- Produces:
  - `dropRoomEdits(edits: ManualEdits, roomIds: Set<string>): ManualEdits` (remove chaves `cômodo:...` dos cômodos dados em `rowShift`, `rowOrder`, `removed`, `hidden`)
  - `floorRoomIds(project: Project, floorId: string): Set<string>`
  - `withFloorTile(p: Project, floorId: string, patch: Partial<TileSpec>): Project` (descarta ajustes dos cômodos do piso)
  - `withFloorLayout(p: Project, floorId: string, patch: Partial<LayoutSpec>): Project` (descarta ajustes do piso se `layoutChangeResetsEdits(patch)`)
  - `withNewFloor(p: Project, copyFrom: string, id: string): Project` (tile = `DEFAULT_TILE` com `jointMm`, `piecesPerBox`, `m2PerBox`, `wastePct` copiados; layout = `DEFAULT_LAYOUT`)
  - `withoutFloor(p: Project, id: string): Project` (primeiro piso não sai; cômodos dele perdem `floorId`)
  - `withRoomFloor(p: Project, roomId: string, floorId: string | null): Project` (`null` → `receivesTile: false`; senão `receivesTile: true, floorId`; descarta ajustes do cômodo)
  - `floorInputs(project: Project): FloorInput[]` (em `src/store/issues.ts`; só pisos com cômodos, na ordem de `floors`; cada um com `roomsInCm` dos seus cômodos)
  - Store: `setTile(floorId, patch)`, `setLayout(floorId, patch)`, `addFloor(copyFrom: string): string`, `removeFloor(id)`, `renameFloor(id, name)`, `setRoomFloor(roomId, floorId | null)`; `Snapshot = { floors: Floor[]; edits: ManualEdits }`; `setPlan`/`startDrawing` zeram `origin`/`start` em todos os pisos.
  - `FloorInput { id: string; tile: TileSpec; layout: LayoutSpec; rooms: RoomCm[] }` fica em `src/tiling/types.ts` (usado pela Task 3).
- [ ] **Step 1: Write the failing tests**
  - `dropRoomEdits` com chaves `a:0`, `a:0:1`, `b:2` e `roomIds = {a}` → só sobra `b:2`.
  - `withFloorTile(p, 'piso-2', { lengthCm: 90 })` em projeto com ajustes nos cômodos `a` (piso 1) e `b` (piso 2) → ajustes de `a` intactos, de `b` removidos, `floors[1].tile.lengthCm === 90`.
  - `withNewFloor(p, 'piso-1', 'x')` com piso 1 de rejunte 3 mm e 5 peças por caixa → novo piso 60 × 60 com `jointMm 3`, `piecesPerBox 5`, nenhum cômodo.
  - `withoutFloor(p, 'piso-1')` não muda nada; `withoutFloor(p, 'piso-2')` → cômodo `b` sem `floorId`, `floors.length === 1`.
  - `withRoomFloor(p, 'b', null)` → `receivesTile false`; `withRoomFloor(p, 'b', 'piso-1')` → ajustes de `b` removidos.
  - `floorInputs`: piso 2 sem cômodos não aparece; cômodo sem `floorId` entra no piso 1.
  - `canAdvance(p, 3)`: com dois pisos e o segundo com `lengthCm: 0` → `ok: false` e `reason === \`${segundo.name}: ${erro}\`` (erro = primeiro de `validateTile`); com um piso só, `reason` é o erro puro (como hoje).
- [ ] **Step 2: Run** `npx vitest run src/floors.test.ts src/store` → FAIL.
- [ ] **Step 3: Implement** as funções puras e as ações do store chamando-as (`setTile`/`setLayout`/`setRoomFloor` guardam histórico como `setLayout` faz hoje quando descartam ajustes).
- [ ] **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat: store por piso (peça, layout, novo piso, cômodo por piso)`

### Task 3: Cálculo por piso e resultado combinado

**Files:**
- Create: `src/tiling/floors.ts`
- Modify: `src/tiling/types.ts` (`Piece.floorId?`, `FloorInput`, `ProjectLayout`)
- Modify: `src/tiling/worker.ts`, `src/tiling/client.ts`
- Test: `src/tiling/floors.test.ts`

**Interfaces:**
- Consumes: `solveLayout`, `computeLayout` (motor atual), `FloorInput` (Task 2).
- Produces:
  - `interface ProjectLayout { pieces: Piece[]; floors: { floorId: string; result: LayoutResult }[]; warnings: string[] }`
  - `mergeFloors(parts: { floorId: string; result: LayoutResult }[]): ProjectLayout` (renumera `n` em sequência na ordem das partes; soma o deslocamento em `fromLeftoverOf`; põe `floorId` em cada peça; junta `warnings`)
  - `solveFloors(floors: FloorInput[], edits?: ManualEdits): ProjectLayout`
  - `replaceFloor(layout: ProjectLayout, floorId: string, result: LayoutResult): ProjectLayout` (para a prévia do arraste)
  - `floorResult(layout: ProjectLayout, floorId: string): LayoutResult | undefined`
  - `solveInWorker(floors: FloorInput[], edits?: ManualEdits): Promise<ProjectLayout>`; `compareInWorker(rooms, tile, layout)` inalterado.
- [ ] **Step 1: Write the failing tests** (`src/tiling/floors.test.ts`, dois cômodos retangulares 310 × 300 lado a lado, piso A 60 × 60 e piso B 90 × 90, rejunte 0)
  - `solveFloors` → peças de A e de B; `n` de 1 a N sem repetição; cada peça com o `floorId` do seu piso.
  - Nenhuma peça de B tem `fromLeftoverOf` apontando para um `n` de peça de A (e vice-versa).
  - `floors[i].result.summary` igual a `solveLayout` do piso sozinho.
  - `replaceFloor(layout, 'A', outro)` → peças de B idênticas às de antes (mesmo `key`, `shape`, `n` relativo preservado pela renumeração).
- [ ] **Step 2: Run** `npx vitest run src/tiling/floors.test.ts` → FAIL.
- [ ] **Step 3: Implement** `src/tiling/floors.ts`; worker `type: 'solve'` recebe `floors` e `edits`; `type: 'compare'` mantém `rooms/tile/layout`.
- [ ] **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat: cálculo por piso com numeração contínua`

### Task 4: Etapa Piso com fichas de piso

**Files:**
- Modify: `src/ui/StepTile.tsx`
- Modify: `src/ui/app.css` (fichas, lista de cômodos do piso)

**Interfaces:**
- Consumes: store da Task 2 (`setTile(floorId, …)`, `setLayout(floorId, …)`, `addFloor`, `removeFloor`, `renameFloor`, `setRoomFloor`), `roomFloorId`.
- Produces: nada usado por outras tasks.

- [ ] **Step 1:** Estado local `activeFloorId` (padrão: primeiro piso). Fichas no topo do painel só com 2+ pisos (nome + medida); botão "+ Outro piso" sempre (discreto, `btn-quiet`), que chama `addFloor(activeFloorId)` e ativa o novo.
- [ ] **Step 2:** Conteúdo atual do painel (cartões, outra medida, rejunte, direção, compra, mais opções) passa a ler e escrever o piso ativo. Com 2+ pisos: campo do nome do piso (`renameFloor`), lista "Cômodos com este piso" (uma linha por cômodo com checkbox: marcado = cômodo neste piso; marcar chama `setRoomFloor(room, activeFloorId)`, desmarcar chama `setRoomFloor(room, null)`), aviso "Nenhum cômodo com este piso" quando vazia, e "Apagar este piso" (não no primeiro, com `window.confirm`).
- [ ] **Step 3:** Amostra (`TilePreview`) mostra o piso ativo; erros de validação do piso ativo; rodapé usa `canAdvance(project, 3)`.
- [ ] **Step 4: Verificar no navegador (celular 375 × 812 e computador):** com um piso a tela é igual à de hoje; criar "+ Outro piso", escolher 85 × 85, marcar um cômodo; a ficha mostra o nome; apagar volta o cômodo ao primeiro piso. `npx tsc -b` sem erros nesses arquivos.
- [ ] **Step 5: Commit** `feat: etapa Piso com vários pisos`

### Task 5: Seletor de piso no cômodo e Dividir cômodo

**Files:**
- Create: `src/editor/split.ts`
- Modify: `src/editor/editorStore.ts` (`Tool` ganha `'split'`), `src/editor/PlanEditor.tsx`, `src/editor/RoomPanel.tsx`, `src/store/project.ts` (`splitRoom`), `src/floors.ts` (`withSplitRoom`), `src/ui/app.css`
- Test: `src/editor/split.test.ts`, `src/floors.test.ts`

**Interfaces:**
- Consumes: `withRoomFloor`/`setRoomFloor` (Task 2), `dropRoomEdits`.
- Produces:
  - `splitRing(ring: Ring, a: Point, b: Point): [Ring, Ring] | null` (linha infinita por `a`–`b`; intersecção do anel com cada semiplano via `polygon-clipping`; `null` se algum lado vier vazio, com mais de um pedaço ou com buraco)
  - `withSplitRoom(p: Project, roomId: string, parts: [Ring, Ring], newId: string): Project` (original fica com `parts[0]`, nome `"{nome} 1"`; novo cômodo `newId` com `parts[1]`, nome `"{nome} 2"`, mesmo `receivesTile`/`floorId`; ambos sem `origin`/`start`; ajustes do original descartados; sem nome, usa `Cômodo {n}` como base)
  - Store: `splitRoom(roomId, parts): string` (devolve o id novo); desfazer usa `updateRoom`/`removeRoom` com o cômodo original guardado no editor.
- [ ] **Step 1: Write the failing tests**
  - `splitRing(retângulo 0,0–400,300, {x:250,y:0}, {x:250,y:300})` → dois anéis com áreas 75 000 e 45 000 (soma 120 000).
  - Linha que não cruza o cômodo (`x = 500`) → `null`.
  - Cômodo em L (0,0 · 400,0 · 400,100 · 100,100 · 100,300 · 0,300) cortado por `y = 50` → dois pedaços.
  - Cômodo em U (0,0 · 300,0 · 300,300 · 200,300 · 200,100 · 100,100 · 100,300 · 0,300) cortado por `y = 200` → três pedaços → `null`.
  - `withSplitRoom` em cômodo "Sala" com ajustes e `start` → "Sala 1" e "Sala 2", mesmo piso, sem `start`, ajustes da sala removidos.
- [ ] **Step 2: Run** `npx vitest run src/editor/split.test.ts src/floors.test.ts` → FAIL.
- [ ] **Step 3: Implement** `split.ts`, `withSplitRoom`, `splitRoom`.
- [ ] **Step 4: Editor:** ferramenta "Dividir cômodo" (curto: "Dividir") na barra; mesmo gesto do desenho (tocar = ponto, arrastar = mover a vista); o primeiro toque escolhe o cômodo sob o dedo (ou o selecionado) e prende o ponto na borda dele (`snapToGeometry` com as bordas do cômodo); o segundo ponto trava perpendicular às paredes (`snapAngle`) e prende na borda; linha prévia com a medida; ao soltar o segundo ponto, `splitRing` → se `null`, aviso "A linha precisa atravessar o cômodo de uma borda à outra, dividindo em dois." e nada muda; se der, `splitRoom` e aviso com botão "Desfazer a divisão" (restaura o cômodo original e remove o novo). Dicas de computador e de toque para a ferramenta.
- [ ] **Step 5: RoomPanel:** com 2+ pisos, troca a caixinha por um seletor segmentado (um botão por piso, rótulo `{L} × {W}`, mais "Sem piso") que chama `setRoomFloor`; com um piso, a caixinha de hoje. O editor pinta o cômodo sem piso como hoje.
- [ ] **Step 6: Run** `npx vitest run` → PASS; verificar no navegador (celular e computador): dividir a sala do exemplo numa linha reta, desfazer, dividir de novo, trocar o piso de um dos lados.
- [ ] **Step 7: Commit** `feat: dividir cômodo e escolher o piso de cada cômodo`

### Task 6: Resultado, recortes, impressão e 3D por piso

**Files:**
- Create: `src/geometry/touch.ts`
- Modify: `src/store/project.ts` (`result: ProjectLayout | null`), `src/ui/StepResult.tsx`, `src/report/Plan2D.tsx`, `src/report/PlanSvg.tsx`, `src/report/Summary.tsx`, `src/report/CutTable.tsx`, `src/report/PrintSheet.tsx`, `src/report/Compare.tsx`, `src/viewer3d/Scene.tsx`, `src/viewer3d/snapshot.ts`, `src/tiling/start.ts` (`entrancePiece` aceita `{ pieces: Piece[] }`), `src/ui/app.css`
- Test: `src/geometry/touch.test.ts`

**Interfaces:**
- Consumes: `ProjectLayout`, `solveInWorker`, `replaceFloor`, `floorResult` (Task 3); `floorInputs`, store por piso (Task 2).
- Produces:
  - `ringsTouch(a: Ring, b: Ring, tolCm?: number): boolean` (algum par de arestas colineares a ≤ `tolCm` que se sobrepõem por mais de `tolCm`; padrão 1)
  - `floorsTouch(floors: FloorInput[]): boolean` (cômodos de pisos diferentes que se encostam)
  - `PlanSvg`, `Scene`, `renderTopView` recebem `{ pieces: Piece[] }`.
  - `Plan2D` troca `tile`/`layout` por `floors: FloorInput[]`; descobre o piso da peça por `piece.floorId`; marca a entrada de cada piso com `entrancePoints(floor.layout, floor.rooms)`.
- [ ] **Step 1: Write the failing tests** (`touch.test.ts`): retângulos 0–300 e 300–600 (mesma altura) → `true`; com 15 cm de parede entre eles (300 e 315) → `false`; encostados só num canto → `false`; deslocados meio cômodo na vertical mas com borda comum de 150 cm → `true`; `floorsTouch` com os dois cômodos no mesmo piso → `false`, em pisos diferentes → `true`.
- [ ] **Step 2: Run** `npx vitest run src/geometry/touch.test.ts` → FAIL; **Step 3:** implementar; **Step 4:** PASS.
- [ ] **Step 5: StepResult por piso:** `solveInWorker(floorInputs(project), edits)`; `activeFloorId` = piso da última peça tocada (padrão: primeiro); prévias do arraste recalculam só o piso arrastado (`computeLayout` com o tile/layout dele) e trocam com `replaceFloor`; `onStart` marca a entrada no piso da peça tocada (`entrancePiece` no resultado combinado → `floorId`; grade contínua → `setLayout(floorId, { start })`, por cômodo → `updateRoom`); `onFloorDrag`/`onRowDrag`/`onPieceDrop` usam tile/layout/origens do piso da peça. Resumo: um `Summary` por piso com título (nome do piso) quando há 2+ pisos. Encaixe, direção e "Deixar o app escolher" valem para `activeFloorId`, com seletor de piso acima deles quando há 2+ pisos. Dica da divisa (texto fixo) quando `floorsTouch(floorInputs(project))`.
- [ ] **Step 6: Relatórios:** `CutTable` agrupa por piso (título com o nome quando há 2+ pisos; a legenda conta inteiras do piso); `Compare` recebe `floorId` e compara o piso ativo; `PrintSheet` recebe `ProjectLayout` + pisos: planta com todos, marca de entrada de cada piso, compra por piso, recortes por piso.
- [ ] **Step 7: Verificar:** `npx tsc -b` sem erros; `npx vitest run` PASS; navegador (celular e computador) com dois pisos: resumo com as duas compras, marcar a entrada num piso não mexe no outro, arrastar o piso de um não mexe no outro, lista de recortes em duas seções, 3D com os dois, dica da divisa aparece com os cômodos encostados.
- [ ] **Step 8: Commit** `feat: resultado, compra e impressão por piso`

### Task 7: Conferência final e publicação

- [ ] **Step 1:** `npx tsc -b`, `npx vitest run`, `npm run build` sem erros.
- [ ] **Step 2:** Navegador, projeto antigo de um piso (o do `localhost:5173`): abre igual, mesmas caixas.
- [ ] **Step 3:** Celular (375 × 812): etapa Piso com duas fichas, seletor no cômodo, Dividir com o dedo, resultado com duas compras.
- [ ] **Step 4:** Atualizar o README (pisos por cômodo, dividir cômodo); commit; `git push` (a Vercel publica a main); conferir no ar que o JS publicado contém "Outro piso".
