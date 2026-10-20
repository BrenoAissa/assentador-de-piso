# Assentador de piso

App web para ver, antes da obra, como o piso vai ficar no seu lar: peças inteiras,
recortes com medida, filetes, sobras reaproveitadas e quantas caixas comprar. A planta entra
por PDF ou imagem (com leitura automática dos cômodos) ou é desenhada no próprio app,
digitando as medidas das paredes. Tudo roda no navegador; a planta não sai do computador.

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

Para testar sem planta própria, toque em "Ver um lar de exemplo" na tela inicial,
escolha "Desenhar minha planta", ou envie `public/exemplo-planta.png` (planta de 10 × 8 m,
escala de 2 px/cm, sem cotas escritas: calibre com a parede externa de 10 m).

## Como usar

1. **Planta**: arraste o PDF/JPG/PNG ou desenhe a planta. A leitura automática encontra
   paredes, cômodos, nomes e, se houver cotas como `3,20 x 4,50` ou `12,5 m²`, a escala.
2. **Cômodos**: confira os contornos. Desenhe paredes digitando os cm, crie cômodos
   retangulares, arraste pontos e cômodos (com ímã de cantos, paredes e guias; segure
   Shift ou desligue o botão Ímã para mexer livre) e marque quais recebem este piso.
3. **Piso**: medidas da peça (placa ou régua), rejunte, encaixe (alinhado, tijolinho ou
   escada), deitada ou em pé, e caixas.
4. **Resultado**: monte do seu jeito. Escolha por onde começar (por exemplo a porta de
   entrada), arraste o piso, deslize fileiras (elas grudam nas paredes e nas juntas das
   vizinhas), troque peças de lugar, apague peças ou marque as que ficam embaixo de móvel.
   Veja em 3D, confira a lista de recortes, compare os encaixes e imprima a folha da obra
   (PDF com a vista 3D de cima).

## Desenvolvimento

```bash
npm test        # testes (motor de paginação, detecção, store)
npm run build   # checagem de tipos + build de produção
node scripts/make-sample-plan.mjs   # regera a planta de exemplo
npx vite-node scripts/make-og.ts    # regera a imagem de prévia do link e os ícones
```

Especificação: `docs/superpowers/specs/2026-10-18-paginador-piso-design.md`.
