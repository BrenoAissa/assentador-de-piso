# Paginador de piso

App web que lê a planta do apartamento (PDF ou imagem), identifica os cômodos e mostra em 3D
e em 2D como o piso vai ficar: peças inteiras, recortes com medida, filetes, sobras
reaproveitadas e quantas caixas comprar. Tudo roda no navegador; a planta não sai do computador.

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

Para testar sem planta própria, use `public/exemplo-planta.png` (apartamento de 10 × 8 m,
escala de 2 px/cm, sem cotas escritas: calibre com a parede externa de 10 m).

## Como usar

1. **Planta**: arraste o PDF/JPG/PNG. A leitura automática encontra paredes, cômodos, nomes
   e, se houver cotas como `3,20 x 4,50` ou `12,5 m²` dentro dos cômodos, a escala.
2. **Cômodos**: confira os contornos. Arraste pontos, crie cômodos à mão, calibre a escala
   com 2 cliques e marque quais recebem este piso.
3. **Piso**: medidas da peça, rejunte, paginação (reta ou amarração), direção e caixas.
4. **Resultado**: 3D, planta 2D numerada (arraste o ponto amarelo para testar outro ponto de
   partida), lista de recortes, comparação entre paginações e impressão para a obra.

## Desenvolvimento

```bash
npm test        # testes (motor de paginação, detecção, store)
npm run build   # checagem de tipos + build de produção
node scripts/make-sample-plan.mjs   # regera a planta de exemplo
```

Especificação: `docs/superpowers/specs/2026-10-18-paginador-piso-design.md`.
