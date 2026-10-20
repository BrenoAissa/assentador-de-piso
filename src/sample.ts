import { rectRing } from './editor/drawing';
import type { Point, Ring } from './geometry/types';
import { drawnPlan, emptyProject, type Project, type Room } from './types';

/** Nome da "planta" do apartamento de exemplo; o Resultado usa para mostrar o aviso de exemplo. */
export const SAMPLE_SOURCE = 'Exemplo';

/**
 * Começo que o app escolhe sozinho para o exemplo (menos filetes). Fica fixo para a tela inicial
 * desenhar na hora, sem esperar a otimização; um teste confere que continua igual ao automático.
 */
export const SAMPLE_ORIGIN: Point = { x: 128, y: 160 };

/** Porta de entrada do exemplo (cm): as peças da tela inicial são assentadas a partir daqui. */
export const SAMPLE_DOOR: Point = { x: 160, y: 795 };

const O = 100; // margem da folha
const at = (ring: Ring): Ring => ring.map((p) => ({ x: p.x + O, y: p.y + O }));
const room = (id: string, name: string, ring: Ring, receivesTile = true): Room => ({
  id,
  name,
  polygonPx: at(ring),
  receivesTile,
  issues: [],
});

/**
 * Apartamento de exemplo, desenhado em cm com paredes de 15 cm: dois quartos, sala integrada
 * com a cozinha (em L), área de serviço e banheiro (com outro piso, não recebe este).
 */
export function sampleProject(): Project {
  const { plan, scale } = drawnPlan();
  return {
    ...emptyProject(),
    plan: { ...plan, sourceName: SAMPLE_SOURCE },
    scale,
    rooms: [
      room('ex-quarto-1', 'Quarto 1', rectRing(0, 0, 320, 300)),
      room('ex-quarto-2', 'Quarto 2', rectRing(335, 0, 280, 300)),
      room('ex-banheiro', 'Banheiro', rectRing(630, 0, 170, 300), false),
      room('ex-sala', 'Sala e cozinha', [
        { x: 0, y: 315 },
        { x: 800, y: 315 },
        { x: 800, y: 565 },
        { x: 470, y: 565 },
        { x: 470, y: 695 },
        { x: 0, y: 695 },
      ]),
      room('ex-area', 'Área de serviço', rectRing(485, 580, 315, 115)),
    ],
  };
}

export const isSample = (p: Project) => p.plan?.kind === 'drawn' && p.plan.sourceName === SAMPLE_SOURCE;
