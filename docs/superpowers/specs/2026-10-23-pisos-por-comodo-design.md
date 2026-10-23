# Pisos diferentes por cômodo: descrição

**Data:** 2026-10-23
**Status:** aguardando aprovação

## Por quê

Nem todo cômodo leva o mesmo piso. O caso real que motivou isto: a cozinha recebe porcelanato
de 85 e o resto da casa porcelanato de 83. A cozinha é aberta para a sala, sem soleira (só a
sacada tem soleira), então os dois porcelanatos se encontram numa linha reta no chão, a divisa.

Cada piso é uma compra separada, com as suas caixas, os seus recortes e as suas sobras, e tem a
sua montagem. Na divisa, quem decide o acabamento é a pessoa ("Eu escolho"): o app dá as
ferramentas e mostra o resultado, mas não escolhe sozinho.

## Objetivos

1. O projeto pode ter mais de um piso. Cada cômodo recebe um piso ou nenhum.
2. Cada piso tem a sua peça (medidas), rejunte, compra (peças ou m² por caixa, folga), encaixe
   (alinhado, tijolinho, escada), direção (deitada ou em pé), grade (contínua no piso ou uma por
   cômodo), começo, entrada marcada e arraste.
3. A compra sai separada por piso: caixas, peças, filetes à vista e desperdício de cada um.
4. Sobra de um piso só é reaproveitada em cômodos do mesmo piso.
5. Dá para dividir um cômodo em dois com uma linha reta (a divisa), para sala e cozinha
   integradas, que hoje viram um cômodo só.
6. Projetos salvos antes, com um piso só, abrem exatamente como antes.

## Fora do escopo

- Dois pisos no mesmo cômodo sem dividi-lo (faixas, molduras, "tapete" de piso).
- Diagonal e espinha de peixe.
- Diferença de espessura ou altura entre pisos no 3D.
- O app decidir ou sugerir sozinho o acabamento na divisa (decisão da pessoa).
- Soleira e rodapé como peças.

## O que não pode acontecer

- Quem usa um piso só sentir o app mais complicado. Com um piso, as telas ficam como hoje; o
  "Outro piso" é um acréscimo discreto.
- Misturar as contas: peça de 85 entrando na caixa do 83, ou sobra de um piso cortada para o
  outro.
- Abrir um projeto antigo e encontrar outra montagem, outras caixas ou ajustes perdidos.
- Piorar o uso no celular, que é onde a maioria vai usar.

## Restrições

- Tudo continua no navegador; nada é enviado.
- Os arquivos de projeto já salvos (marca `assentador-piso` ou `paginador-piso`, versão 1) abrem
  e passam a ter um piso, com a peça e o layout que tinham.
- Funciona com toque e em tela estreita, como a versão atual (desenho, montagem, painéis).
- O motor de cálculo continua coberto por testes, como hoje.

## Como funciona

### Pisos

- O projeto tem uma lista de pisos, sempre com pelo menos um. Um piso reúne um nome, a peça e o
  layout (o que hoje são a peça e o layout do projeto inteiro).
- Nome padrão gerado pelas medidas, por exemplo "Piso 83 × 83 cm"; a pessoa pode renomear
  ("Porcelanato da cozinha").
- Cada cômodo recebe um piso ou fica sem piso (o que hoje é desmarcar "Recebe este piso").
- Cômodo novo (desenhado, detectado ou dividido) recebe o primeiro piso, salvo indicação
  contrária.

### Etapa Cômodos

- Com um piso só, a lista de cômodos fica como hoje (caixinha "Recebe este piso").
- Com dois ou mais pisos, a caixinha vira um seletor curto: um botão para cada piso mais "Sem
  piso", que cabe na largura do celular.
- Nova ferramenta na barra do editor: **Dividir cômodo**.
  - Com o cômodo escolhido, a pessoa marca a linha da divisa com dois toques (ou cliques) nas
    bordas dele. O ímã atua como no desenho de paredes: perpendicular às paredes, cantos e cm
    inteiros, com a medida aparecendo.
  - A linha precisa atravessar o cômodo de borda a borda e dividi-lo em exatamente dois
    pedaços; se não der, o app avisa e não divide.
  - O resultado são dois cômodos encostados, sem parede entre eles. Cada um herda o piso do
    original, e a pessoa troca o piso de um deles. Os nomes ficam editáveis (sugestão: o nome do
    original com "1" e "2").
  - Logo depois de dividir, um aviso oferece "Desfazer a divisão".
  - Ajustes manuais do cômodo original (fileiras, peças apagadas), o começo próprio e a entrada
    marcada nele se perdem na divisão, porque a grade dele muda.

### Etapa Piso

- No topo, uma ficha para cada piso ("Piso 83 × 83 cm", "Piso 85 × 85 cm") e "+ Outro piso".
  Com um piso só, as fichas não aparecem; só o "+ Outro piso", discreto.
- A ficha selecionada mostra o que existe hoje (cartões de peça, outra medida, rejunte, compra,
  mais opções) para aquele piso, mais a lista **Cômodos com este piso**, onde se marca cada
  cômodo com um toque. Marcar um cômodo aqui o tira do outro piso.
- "+ Outro piso" cria um piso novo, sem cômodos, copiando rejunte e compra do piso atual; a
  pessoa escolhe a peça e marca os cômodos.
- Apagar um piso (menos o primeiro) devolve os cômodos dele ao primeiro piso, com confirmação.
- Um piso sem cômodos não entra no resultado nem na compra; a ficha mostra "Nenhum cômodo com
  este piso".
- "Montar o piso" exige medidas válidas em todos os pisos e pelo menos um cômodo com piso.

### Etapa Resultado

- A planta mostra todos os pisos juntos, cada cômodo com o seu. As cores das peças continuam as
  de hoje (inteira, recortada, filete, embaixo de móvel, apagada). A divisa aparece como linha
  de borda, sem parede.
- **Resumo por piso:** para cada piso, o nome, as caixas a comprar e os filetes à vista, com os
  detalhes do piso em "Detalhes". Com um piso só, o resumo fica como hoje.
- **As ferramentas valem para o piso da peça tocada:**
  - *Marcar a entrada:* uma entrada por piso. Tocar numa peça do piso de 85 marca a entrada do
    85 e não mexe no 83.
  - *Arrastar o piso:* move só a grade do piso tocado. O ímã das paredes considera as bordas dos
    cômodos daquele piso, divisa incluída.
  - *Arrastar fileira* e *Mexer na peça:* como hoje (já são por cômodo).
- **Encaixe e direção são escolhidos por piso.** O painel mostra de qual piso se trata, com o
  piso da última peça tocada já selecionado, e um seletor para trocar. "Deixar o app escolher o
  começo" também vale por piso.
- **Na divisa nada é automático.** Quando dois pisos diferentes se encostam sem parede (bordas
  de cômodos de pisos diferentes que se sobrepõem, com tolerância de 1 cm), aparece uma dica: "Para peça inteira dos dois lados da divisa, marque a entrada encostada nela em cada
  piso."
- **Comparar encaixes:** compara o piso selecionado.
- **Lista de recortes:** separada por piso, com o nome de cada piso no título da seção.
- **3D:** todos os pisos.
- **Desfazer:** como hoje, um histórico só, que cobre os ajustes de todos os pisos.
- **Folha impressa:** a planta com todos os pisos e a marca de entrada de cada um, a compra por
  piso e a tabela de recortes por piso.

### Cálculo

- Cada piso é paginado separadamente, só com os seus cômodos, a sua peça e o seu layout, com o
  motor atual.
- Sobras só passam entre cômodos do mesmo piso.
- O resultado mostrado junta as peças de todos os pisos; cada peça sabe de que piso é. A
  numeração das peças segue contínua de um piso para o outro, para não haver dois números iguais
  na mesma planta.
- Os ajustes manuais (fileira deslizada, peça reordenada, apagada, embaixo de móvel) continuam
  por cômodo. Mudar a peça, o rejunte, o encaixe, a direção ou a grade de um piso desfaz só os
  ajustes dos cômodos daquele piso. Um cômodo que troca de piso perde os ajustes dele, porque
  passa para outra grade.

### Projetos salvos e o exemplo

- Projeto antigo vira um projeto de um piso, com a peça e o layout que tinha. Os cômodos que
  recebiam piso passam a receber esse piso e os ajustes manuais continuam valendo.
- O lar de exemplo continua com um piso; a tela inicial não muda.

## Decisões minhas (para você conferir)

1. Nome padrão do piso pelas medidas: "Piso 83 × 83 cm".
2. O seletor de piso na lista de cômodos só aparece quando há dois ou mais pisos.
3. Um piso novo copia rejunte e compra do piso que estava aberto.
4. Apagar um piso devolve os cômodos dele ao primeiro piso.
5. Numeração das peças contínua entre os pisos.
6. No Resultado, encaixe e direção abrem no piso da última peça tocada.
7. Mudar um piso desfaz só os ajustes manuais daquele piso.
8. Dividir cômodo: só em dois pedaços, com linha reta, e "Desfazer a divisão" logo depois.
9. Na divisa, só a dica, sem sugestão automática (decisão sua).
10. As cores das peças são as mesmas nos dois pisos; o piso aparece no resumo, na lista de
    recortes e no seletor do cômodo.
11. Dois pisos "se encostam" quando bordas de cômodos de pisos diferentes se sobrepõem, com
    tolerância de 1 cm; é isso que faz a dica da divisa aparecer.
12. Cômodo que troca de piso perde os ajustes manuais; cômodo dividido perde ajustes, começo e
    entrada.

## A cargo de quem constrói

- Estrutura exata dos dados e a conversão dos projetos antigos, mantendo os testes atuais.
- O algoritmo de corte do polígono (a biblioteca `polygon-clipping` já está no projeto).
- O desenho exato das fichas e dos seletores, dentro do sistema visual atual e funcionando bem no
  celular.
- Digitar a distância da divisa até um canto, se couber sem complicar a ferramenta.
