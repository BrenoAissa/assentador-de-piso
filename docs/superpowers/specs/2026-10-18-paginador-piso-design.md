# Paginador de Piso — Especificação de Design

**Data:** 2026-10-18
**Status:** aguardando revisão do usuário

## 1. Objetivo

App web que recebe a planta de um apartamento (PDF ou imagem), identifica os cômodos e suas
medidas, e mostra em 3D e em 2D como o piso vai ficar: onde cai cada peça, quais peças são
inteiras, onde estão os recortes e com que medida, como evitar recortes finos ("filetes") e
quantas caixas comprar. A planta 2D numerada serve como "mapa do quebra-cabeça" para o
assentador.

## 2. Escopo

### Dentro da v1

- Entrada: PDF (qualquer página, com seletor) ou imagem JPG/PNG.
- Detecção automática local (sem IA na nuvem, sem backend) de paredes, cômodos, nomes de
  cômodos e escala a partir das cotas escritas dentro dos cômodos.
- Editor de conferência: ajustar contornos, desenhar cômodos à mão, calibrar escala com 2
  cliques, nomear cômodos e marcar quais recebem o piso.
- Piso genérico: placas (porcelanato/cerâmica) ou réguas (vinílico/laminado), com rejunte
  configurável (pode ser 0).
- Paginações: **reta** e **amarração** (deslocamento de 1/2, 1/3, 1/4 ou valor livre em cm).
- Direção da peça: 0° ou 90°.
- Ponto de partida otimizado automaticamente + ajuste manual arrastando a grade.
- Grade única para o apartamento inteiro (padrão) ou grade independente por cômodo.
- Classificação de cada peça: inteira, recortada, filete. Numeração e medidas dos recortes.
- Reaproveitamento de sobras (guloso) com indicação "peça X sai da sobra da peça Y".
- Comparativo entre paginações (reta, amarração 1/2, amarração 1/3).
- Visualização 3D navegável e planta 2D numerada imprimível com lista de recortes.
- Quantidade de peças e caixas, com margem de perda.
- Projeto salvo automaticamente no navegador; exportar e importar em JSON.

### Fora da v1

- Paginação diagonal 45° e espinha de peixe.
- Paredes curvas.
- Arquivos DWG/CAD.
- Leitura de cotas lineares externas (ao longo das paredes). Nesse caso, a escala é calibrada
  manualmente.
- Piso nos vãos de porta (normalmente vai soleira).
- Mais de um tipo de piso no mesmo projeto. Banheiro com outro piso = outro projeto, ou
  desmarcar o cômodo.
- Reaproveitamento de sobras com formato irregular (só sobras retangulares de cortes retos).
- Rodapé, soleiras, rodameio.

## 3. Fluxo do usuário

Página única com 4 passos numa barra no topo. Só é possível avançar quando o passo atual está
completo; voltar é sempre possível.

1. **Planta** — arrastar ou escolher arquivo. Se for PDF com várias páginas, escolher a página.
   A detecção começa automaticamente, com barra de progresso.
2. **Cômodos** — a planta aparece com os contornos detectados por cima. Barra lateral com:
   - lista de cômodos (nome, medidas aproximadas, área, "recebe piso" sim/não, confiança);
   - **pendências** que o app pede para resolver: escala não encontrada, cômodo com baixa
     confiança, medidas que discordam da escala, cômodo sem nome.

   Ferramentas: selecionar/mover vértice, adicionar vértice (duplo clique na aresta), remover
   vértice (Delete), novo cômodo (clicar os cantos, fechar no primeiro ponto), excluir cômodo,
   calibrar escala (clicar 2 pontos e digitar a distância em cm), refazer detecção com
   sensibilidade ajustada. Zoom e pan com roda do mouse e arrastar.
3. **Piso** — formulário: comprimento e largura da peça (cm), rejunte (mm), paginação,
   deslocamento da amarração, direção, peças por caixa (e m² por caixa, opcional), margem de
   perda (%), limite de filete (cm e fração da peça), modo de grade (única/por cômodo).
4. **Resultado** — abas:
   - **3D**: cena navegável; clicar numa peça mostra número, tipo, medida do recorte e origem
     (peça nova ou sobra de qual peça).
   - **Planta 2D**: peças numeradas e coloridas, medida escrita nos recortes; arrastar a grade
     muda o ponto de partida (desliga o "automático"); botão "otimizar de novo".
   - **Recortes**: tabela com nº da peça, cômodo, medida, tipo de corte, origem.
   - **Comparativo**: tabela com reta / amarração 1/2 / amarração 1/3, cada uma com ponto de
     partida otimizado: peças inteiras, recortes, filetes, peças a comprar, caixas, desperdício.
     Botão "usar esta" em cada linha.
   - Resumo sempre visível: área (m²), peças a comprar, caixas, desperdício (%).
   - Botão **Imprimir** (planta 2D + lista de recortes + resumo), via CSS de impressão.

Cores: inteira = cinza, recortada = azul, filete = vermelho, peça tirada de sobra = azul com
borda tracejada.

## 4. Modelo de dados

Unidade interna: **centímetros**. Coordenadas da planta com origem no canto superior esquerdo
da imagem e `y` para baixo. No 3D, `x → x`, `y → z`, com `y` do 3D para cima.

```ts
type Point = { x: number; y: number };

interface Project {
  version: 1;
  plan: PlanImage | null;
  scale: Scale | null;              // null = escala ainda não definida
  rooms: Room[];
  tile: TileSpec;
  layout: LayoutSpec;
}

interface PlanImage {
  imageId: string;                  // chave no IndexedDB
  widthPx: number;
  heightPx: number;
  sourceName: string;
  pdfPage?: number;
}

interface Scale {
  pxPerCm: number;
  source: 'ocr' | 'manual';
  confidence: number;               // 0..1
}

interface Room {
  id: string;
  name: string;
  polygonPx: Point[];               // contorno interno das paredes, em px da imagem original
  receivesTile: boolean;
  confidence?: number;              // só para cômodos detectados
  issues: RoomIssue[];
  origin?: Point;                   // só no modo de grade por cômodo; ausente = automático
}

type RoomIssue = 'low-confidence' | 'scale-mismatch' | 'unnamed' | 'invalid-polygon';

interface TileSpec {
  lengthCm: number;                 // lado maior
  widthCm: number;                  // lado menor (igual ao maior em placa quadrada)
  jointMm: number;                  // rejunte; 0 para régua sem rejunte
  piecesPerBox: number;
  m2PerBox?: number;
  wastePct: number;                 // padrão 10
}

interface LayoutSpec {
  pattern: 'straight' | 'running';
  runningOffset: { kind: 'fraction'; value: number } | { kind: 'cm'; value: number };
  rotationDeg: 0 | 90;              // 0 = comprimento da peça na horizontal da planta
  gridMode: 'global' | 'perRoom';
  origin: Point | 'auto';           // modo global
  minCutCm: number;                 // padrão 5
  minCutFraction: number;           // padrão 1/3
  kerfCm: number;                   // perda do disco de corte, padrão 0.3
}
```

Os cômodos ficam em px porque a escala pode mudar depois (calibração). A conversão para cm é
derivada: `cm = px / pxPerCm`.

Resultado do motor (calculado, nunca salvo):

```ts
interface Piece {
  n: number;                        // número exibido
  roomId: string;
  tileRect: Rect;                   // retângulo da peça inteira, em cm
  shape: Point[][];                 // parte que fica no cômodo (pode ter mais de um anel)
  kind: 'full' | 'cut' | 'sliver';
  cutType?: 'straight' | 'corner' | 'shaped';  // reto em 1 lado, reto em 2 lados, irregular
  cutSize?: { w: number; h: number };          // medida do recorte (caixa envolvente)
  fromLeftoverOf?: number;          // nº da peça cuja sobra foi usada
}

interface LayoutResult {
  pieces: Piece[];
  summary: {
    areaM2: number;
    full: number;
    cut: number;                    // todas as recortadas, filetes incluídos
    slivers: number;                // subconjunto de `cut`
    fromLeftovers: number;
    tilesToBuy: number;             // peças novas + margem de perda, arredondado para cima
    boxes: number;
    wastePct: number;               // área comprada que não vira piso / área comprada
  };
  originUsed: Point;
  warnings: string[];
}
```

## 5. Motor de paginação (`tiling/`)

Funções puras, sem React nem DOM. Entrada: cômodos em cm, `TileSpec`, `LayoutSpec`. Saída:
`LayoutResult`.

### 5.1 Referencial da paginação

O motor sempre trabalha num referencial em que as fileiras correm ao longo de `x` e o
comprimento da peça fica em `x`. Para `rotationDeg = 90`, os pontos são trocados
(`(x, y) → (y, x)`) na entrada e destrocados na saída. Retângulos continuam retângulos e a
orientação dos polígonos é normalizada.

- Passo em x: `px = lengthCm + jointCm`. Passo em y: `py = widthCm + jointCm`.
- Fileira `r` ocupa `y ∈ [oy + r·py, oy + r·py + widthCm)`.
- Deslocamento da fileira `r`: `0` na reta; na amarração, `(r · d) mod px`, com `d` = fração ×
  `px` (o passo inclui o rejunte, então 1/3 repete exatamente a cada 3 fileiras) ou o valor
  em cm.
- Peça `(r, c)` ocupa `x ∈ [ox + shift(r) + c·px, … + lengthCm)`.

### 5.2 Geração e recorte

1. Gerar os retângulos que cobrem a caixa envolvente da união dos cômodos que recebem piso.
2. Para cada retângulo e cada cômodo, calcular a interseção com `polygon-clipping`. Descartar
   interseções com área < 0,5 cm².
3. Classificar:
   - **inteira**: área da interseção ≥ 99,5% da área da peça;
   - **recortada**: caso contrário. `cutSize` = caixa envolvente da interseção. `cutType`:
     `straight` se a interseção é um retângulo com só uma dimensão reduzida, `corner` se é um
     retângulo com as duas reduzidas, `shaped` se não é retângulo;
   - **filete**: recortada em que uma dimensão reduzida fica abaixo do limite.
     Limite em x = `max(minCutCm, minCutFraction · lengthCm)`; em y idem com `widthCm`.
4. Numerar as peças cômodo a cômodo, na ordem da lista de cômodos, com números únicos no
   projeto (ex.: Sala 1–48, Cozinha 49–80). Dentro do cômodo, seguir as fileiras da paginação
   (fileira 0 primeiro) e, dentro da fileira, a ordem de assentamento (`c` crescente). Com 90°,
   as fileiras são verticais na planta.

### 5.3 Otimização do ponto de partida

Testar todos os pontos de partida `(ox, oy)` em `[0, px) × [0, py)` com passo de 1 cm, em
duas fases:

1. **Fase rápida (analítica):** para cada aresta de parede alinhada aos eixos, calcular onde
   ela cai dentro do passo da grade. Isso dá, fileira a fileira (ou coluna a coluna), a largura
   do recorte junto daquela parede. Somar filetes e recortes ponderados pelo número de peças ao
   longo da aresta. Arestas inclinadas ficam fora desta fase. Custo: O(candidatos × arestas ×
   fileiras), sem recorte de polígonos.
2. **Fase exata:** pegar os 20 melhores candidatos, rodar o motor completo (5.2 + 5.4) em cada
   um e escolher pela ordem: menos filetes → menos peças a comprar → menos recortes → mais
   centralizado (desempate).

No modo `global`, a pontuação soma todos os cômodos que recebem piso. No modo `perRoom`, cada
cômodo é otimizado sozinho.

### 5.4 Reaproveitamento de sobras

Regra prática adotada: o lado cortado vai contra a parede (fica sob o rodapé) e o lado de
fábrica fica à vista. Uma sobra tem um lado de fábrica, então **cada sobra é usada uma vez só**.

Algoritmo guloso:

1. Só participam recortes `straight` (sobra retangular previsível).
2. Sobra de um corte em x: `(lengthCm − cutW − kerfCm) × widthCm`. Corte em y: análogo.
3. Ordenar os recortes `straight` por tamanho necessário, do maior para o menor.
4. Para cada recorte, procurar no estoque de sobras a menor que atenda: mesma dimensão no
   eixo não cortado e comprimento ≥ necessário. Se achar, marcar `fromLeftoverOf` e remover a
   sobra do estoque. Se não achar, a peça é nova e a sobra dela entra no estoque, desde que
   não seja filete.
5. Peças a comprar = inteiras + recortes que não vieram de sobra.

Para réguas, isso cobre o caso clássico em que a sobra do fim de uma fileira inicia a próxima.

### 5.5 Contagem

- `tilesToBuy = ceil(pecasNovas · (1 + wastePct/100))`.
- `boxes = ceil(tilesToBuy / piecesPerBox)`. Se o usuário der só `m2PerBox`, então
  `piecesPerBox = round(m2PerBox / áreaDaPeça)`.
- `wastePct` do resultado = `1 − áreaDoPiso / (tilesToBuy · áreaDaPeça)`.

### 5.6 Comparativo

Roda o motor com otimização automática para: reta, amarração 1/2 e amarração 1/3, mantendo o
resto do `LayoutSpec`. Usa um Web Worker para não travar a tela.

## 6. Detecção automática (`detection/`)

Roda num Web Worker, com mensagens de progresso. A imagem é reduzida para no máximo 1600 px
no lado maior. Os resultados voltam convertidos para px da imagem original.

### 6.1 Pipeline

1. **Binarização:** tons de cinza por luminância → limiar de Otsu → máscara escura (1 = tinta).
2. **Espessura de parede `t`:** histograma dos comprimentos de sequências contínuas de pixels
   escuros, na horizontal e na vertical, considerando só sequências ≥ 3 px. `t` = moda.
3. **Paredes preenchidas:** abertura morfológica com quadrado de lado `ceil(0,6·t)`. Isso
   apaga traços mais finos que a parede: móveis, textos, linhas de cota, arcos de porta e
   hachuras finas. Erosão e dilatação são feitas com filtros de mínimo/máximo separáveis em
   O(n).
4. **Paredes só com contorno (fallback):** se a abertura deixar menos de 2% de pixels de
   parede, a planta provavelmente desenha a parede como duas linhas paralelas. Nesse caso, as
   regiões brancas fechadas, finas e alongadas (raio inscrito máximo pequeno, medido por
   transformada de distância) são preenchidas como parede antes da abertura. Também pode ser
   ativado manualmente.
5. **Fechar vãos de porta e janela:** fechamento direcional. Fechamento horizontal com
   elemento `1 × D` e vertical com `D × 1`, `D = 20·t` (ajustável pela "sensibilidade"). Só
   são mantidos os preenchimentos cujo componente tem espessura ≤ `1,5·t` no eixo
   perpendicular. Assim um vão numa parede é fechado, mas um corredor entre duas paredes
   paralelas não é.
6. **Cômodos:** componentes conexos (vizinhança 4) da área livre. Descartar os componentes que
   tocam a borda da imagem (lado de fora) e os com área < `(8·t)²`. Preencher buracos internos
   (móveis desenhados cheios, bancadas).
7. **Contorno:** rastreamento de borda (Moore) → simplificação Douglas–Peucker com
   `ε = t/2` → alinhamento de arestas com até ±5° de inclinação aos eixos → fusão de pontos
   colineares.
8. **Confiança por cômodo (0..1):** combina retangularidade (área / área da caixa
   envolvente, com peso menor), quantidade de vértices, se o cômodo encostou em vão fechado
   artificialmente e se tem cota lida.

### 6.2 OCR (nomes e cotas)

- `tesseract.js`, idioma `por`, modo texto esparso, na imagem original (ampliada 2× se o texto
  for pequeno).
- Os dados do idioma são baixados no primeiro uso e ficam em cache do navegador. Se o download
  falhar, a detecção segue sem OCR e o app pede a calibração manual.
- Cada texto é associado ao cômodo cujo polígono contém o centro do texto.
- Padrões reconhecidos (vírgula ou ponto decimal):
  - medidas: `3,20 x 4,50`, `3.20X4.50`, `3,20 × 4,50` → metros;
  - área: `12,50 m²`, `12,5m2`;
  - nomes: lista conhecida (sala, estar, jantar, cozinha, dormitório/dorm./quarto, suíte,
    banho/banheiro/wc/lavabo, área de serviço/a.s., varanda/sacada, circulação/hall,
    escritório, closet), sem diferenciar acentos e maiúsculas.

### 6.3 Escala

- Por medidas: caixa envolvente do cômodo `(wPx, hPx)` contra `(a, b)` em metros. Testar as
  duas orientações e ficar com a que der estimativas de px/cm mais próximas. A estimativa só
  vale se as duas concordarem dentro de 8%.
- Por área: `pxPerCm = sqrt(áreaPx / (área · 10000))`.
- Escala final = mediana das estimativas válidas. Confiança vem da dispersão. Cômodos com
  estimativa mais de 10% longe da mediana recebem a pendência `scale-mismatch`.
- Sem estimativas válidas: `scale = null`, e o passo 2 mostra a pendência "calibre a escala".

### 6.4 Saída

```ts
interface DetectionResult {
  rooms: Array<{ polygonPx: Point[]; name?: string; confidence: number;
                 dims?: { a: number; b: number }; areaM2?: number }>;
  scale: Scale | null;
  wallThicknessPx: number;
  mode: 'filled' | 'outline';
  warnings: string[];
}
```

## 7. Interface

- **Stack:** Vite + React + TypeScript; Three.js via `@react-three/fiber` e `@react-three/drei`;
  `pdfjs-dist`; `tesseract.js`; `polygon-clipping`; `zustand`; `idb-keyval`; Vitest.
- **Editor (passo 2):** imagem da planta com uma camada SVG por cima, no mesmo sistema de
  coordenadas (px da imagem). Pan e zoom via `transform`. Nenhuma biblioteca de canvas.
- **Planta 2D (passo 4):** SVG em cm, com peças, números e medidas. A mesma composição é
  usada na impressão.
- **3D (passo 4):** cada peça vira um `ExtrudeGeometry` de 1 cm de altura a partir de `shape`,
  sobre um plano escuro que faz o papel do rejunte. Paredes como faixas extrudadas de 10 cm de
  espessura e 100 cm de altura, semitransparentes, para enxergar o piso. `OrbitControls`.
  Clique com raycast destaca a peça. Acima de 3.000 peças, as inteiras usam `InstancedMesh`.
- **Estilo visual:** interface de ferramenta, sóbria e legível. A planta e o piso são o
  destaque. Funciona em notebook e desktop; celular só para consulta (passo 4).

## 8. Persistência

- Projeto (JSON) e imagem da planta (Blob) no IndexedDB via `idb-keyval`, com salvamento
  automático (debounce de 1 s). A imagem não vai para o `localStorage` porque o limite de
  ~5 MB estoura.
- Exportar: um arquivo `.json` com a imagem em base64 embutida. Importar: o inverso.

## 9. Erros e casos de borda

| Situação | Comportamento |
|---|---|
| PDF com várias páginas | seletor de página antes da detecção |
| Arquivo inválido ou corrompido | mensagem clara, continua no passo 1 |
| Detecção falha ou acha 0 cômodos | aviso + editor vazio para desenhar à mão |
| OCR indisponível | segue sem nomes e escala; pendência de calibração |
| Polígono que se cruza | pendência `invalid-polygon`; o cômodo fica fora do cálculo até corrigir |
| Escala ausente | passos 3 e 4 bloqueados, com o motivo exibido |
| Peça com medida ≤ 0 ou rejunte negativo | validação no formulário |
| Mais de 20.000 peças | aviso; cálculo e 2D normais; 3D só com instancing |
| Nenhum cômodo marcado para receber piso | passo 4 bloqueado com o motivo |

## 10. Estrutura do projeto

```
paginador-piso/
  index.html
  package.json
  vite.config.ts
  src/
    main.tsx
    App.tsx                 # barra de passos + roteamento entre passos
    store/                  # zustand: projeto, passo atual, resultado
    geometry/               # Point, Rect, área, caixa envolvente, conversões, validação
    tiling/                 # grid.ts, clip.ts, classify.ts, optimize.ts, leftovers.ts,
                            # count.ts, engine.ts (orquestra), worker.ts
    detection/              # binarize.ts, morphology.ts, thickness.ts, gaps.ts,
                            # components.ts, contour.ts, simplify.ts, ocr.ts, scale.ts,
                            # pipeline.ts, worker.ts
    input/                  # carregar PDF/imagem, seletor de página
    editor/                 # camada SVG, ferramentas, calibração, pendências
    viewer3d/               # cena, peças, paredes, seleção
    report/                 # planta 2D, tabela de recortes, comparativo, impressão
    persistence/            # IndexedDB, exportar/importar
  docs/superpowers/specs/
```

Testes ficam ao lado do código (`*.test.ts`).

## 11. Testes

**Motor de paginação (TDD, escrito antes do código):**
- Cômodo 300 × 300 cm, peça 60 × 60, sem rejunte, origem 0 → 25 inteiras, 0 recortes.
- Mesmo cômodo com 2 mm de rejunte → contagem e medidas de recorte exatas.
- Cômodo 310 × 300, peça 60 × 60 → origem automática nunca deixa recorte de 10 cm se houver
  alternativa (deve dividir em 2 recortes de 35 cm ou similar).
- Cômodo em L → peças no canto interno classificadas como `corner`/`shaped` corretamente;
  nenhuma peça fora do polígono.
- Amarração 1/2 → deslocamento por fileira correto; com 1/3, o ciclo se repete a cada 3
  fileiras.
- Rotação 90° → resultado equivalente ao cômodo transposto.
- Sobras: régua 20 × 120 em cômodo 250 × 200 → recortes de fim de fileira reaproveitados no
  início da seguinte quando cabem; cada sobra usada no máximo uma vez.
- Contagem: caixas e desperdício com valores conhecidos.
- Área total das peças recortadas + inteiras = área do cômodo menos o rejunte (tolerância).

**Detecção (imagens sintéticas geradas no próprio teste):**
- Planta com 3 cômodos retangulares e paredes de 10 px → 3 polígonos com os cantos certos
  (tolerância de ±2 px).
- Mesma planta com vão de porta → o vão é fechado e os cômodos continuam separados.
- Corredor de 30 px entre paredes paralelas → não é fechado.
- Traços finos (móveis/textos simulados) → não viram parede.
- Cômodo em L → polígono de 6 vértices.
- Parsing de cotas: `3,20 x 4,50`, `3.2X4.5`, `12,5 m²`, `12,50m2`.
- Escala: medidas coerentes → mediana correta; uma medida discrepante → pendência no cômodo.

**Manual/no navegador:**
- A planta real do usuário: detecção, ajustes, resultado e conferência visual.
- Fluxo completo nos 4 passos, impressão e salvar/reabrir.

## 12. Ordem de construção

1. Base do projeto (Vite + React + TS + Vitest) e `geometry/`.
2. Motor de paginação completo, com testes.
3. Entrada (PDF/imagem) + editor manual + calibração + persistência.
4. Passo 3 (piso) + passo 4: planta 2D, tabela de recortes, resumo, comparativo, impressão.
5. Visualização 3D.
6. Detecção automática: paredes → cômodos → OCR → escala → pendências.
7. Ajuste fino com a planta real do usuário.

Cada etapa termina com o app funcionando. A detecção é a última porque só preenche o editor,
que já funciona à mão.
