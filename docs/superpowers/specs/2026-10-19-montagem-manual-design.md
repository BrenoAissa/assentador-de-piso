# Montagem manual do piso — Descrição

**Data:** 2026-10-19
**Status:** aprovada em conversa ("Nada, pode implementar")

## Por quê

O resultado automático é um ponto de partida, não a resposta. Quem vai morar no apartamento
sabe onde vão os móveis e quer **esconder os filetes embaixo deles**, deixando **peça inteira
onde se bate o olho** (a porta de entrada). O passo 3 hoje parece analítico demais
("paginação", "deslocamento entre fileiras").

## O que muda

### 1. Começar aqui
Ferramenta na tela de montagem: clicar num ponto (ex.: a porta de entrada) faz o piso começar
dali.
- Se o ponto está perto (≤ 60 cm) de uma parede alinhada aos eixos, a fileira encosta nessa
  parede com peça inteira (a borda da peça na face da parede).
- Ao longo da parede, uma peça fica centralizada no ponto — ou a junta fica centralizada, o que
  der menos filetes.
- Longe de paredes, uma peça fica centralizada no ponto nos dois sentidos.
- Os recortes vão para as paredes do lado oposto.

### 2. Três níveis de ajuste, do maior para o menor
- **Arrastar o piso:** move a grade inteira (o que hoje é o ponto amarelo).
- **Arrastar fileira:** desliza uma fileira de um cômodo ao longo dela; muda os recortes das
  duas pontas dessa fileira.
- **Mexer na peça:** arrastar uma peça dentro da própria fileira reorganiza a fileira (a peça
  troca de lugar e as outras se acomodam, sem buraco nem sobreposição; vale para fileiras de
  peças retangulares). A peça selecionada pode ser **apagada** (onde vai móvel fixo, sem piso
  por baixo) ou marcada **"fica embaixo de móvel"** (o filete deixa de contar como à vista).
- **Desfazer** (botão e Ctrl+Z).
- Tudo recalcula na hora: recortes, peças, caixas.
- Ajustes de fileira e peça valem para a grade atual. Mudar peça, rejunte, direção, encaixe ou
  arrastar o piso inteiro desfaz esses ajustes — o app avisa antes.

### 3. Ver os móveis
A planta original aparece por cima das peças em modo "multiplicar" (o branco some, as linhas
dos móveis ficam visíveis), com botão para mostrar/esconder.

### 4. Menos análise
- **Passo 3** fica com: peça (cartões visuais com tamanhos comuns + medida própria), espaço
  entre peças (rejunte), deitada/em pé (só para peça retangular) e compra. "Paginação" e
  "deslocamento" saem do passo 3.
- **Encaixe das fileiras** vira uma escolha visual na tela de montagem: Alinhado, Tijolinho
  (meia peça), Escada (1/3 da peça). Arrastar fileiras dá o ajuste fino.
- **Resumo** mostra o que importa: caixas a comprar e filetes à vista. O resto (inteiras,
  recortes, sobras, desperdício) fica em "Detalhes".
- A aba de edição (2D) passa a ser a primeira; o 3D continua para visualizar.

## Fora do escopo agora
- Mover peça livremente fora da fileira (geraria piso impossível de executar).
- Girar peça individual (quebra a grade; a direção continua sendo do piso todo).
- Detectar móveis automaticamente.

## Decisões minhas (sem perguntar)
- Distância para "encostar" na parede: 60 cm.
- Reorganizar fileira só quando todas as peças da fileira naquele cômodo são retangulares.
- Ajustes guardados por chave `cômodo:fileira:posição` da grade atual e apagados quando a grade
  muda.
- Desfazer guarda até 50 passos, só na sessão (não vai para o arquivo salvo).
