import { describe, expect, it } from 'vitest';
import { bbox, polygonArea } from '../geometry/polygon';
import type { Ring } from '../geometry/types';
import {
  edgeLengths,
  placeBeside,
  pointAtDistance,
  rectRing,
  setEdgeLength,
  snapAngle,
  snapMove,
  snapToGeometry,
  snapToGrid,
  translateRing,
} from './drawing';

describe('snapAngle', () => {
  it('trava em 0° quando o mouse está quase na horizontal', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 8 });
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(Math.hypot(100, 8));
  });

  it('trava em 90° quando está quase na vertical', () => {
    const p = snapAngle({ x: 50, y: 50 }, { x: 55, y: -150 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeLessThan(50);
  });

  it('deixa livre quando o ângulo está longe dos eixos ou a trava está desligada', () => {
    expect(snapAngle({ x: 0, y: 0 }, { x: 100, y: 40 })).toEqual({ x: 100, y: 40 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 100, y: 8 }, false)).toEqual({ x: 100, y: 8 });
  });
});

describe('pointAtDistance', () => {
  it('anda a distância exata na direção indicada', () => {
    expect(pointAtDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, 320)).toEqual({ x: 320, y: 0 });
    const p = pointAtDistance({ x: 0, y: 0 }, { x: 0, y: -1 }, 280);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-280);
  });

  it('sem direção definida, segue para a direita', () => {
    expect(pointAtDistance({ x: 5, y: 5 }, { x: 5, y: 5 }, 100)).toEqual({ x: 105, y: 5 });
  });
});

describe('snapToGrid', () => {
  it('arredonda para o passo da grade', () => {
    expect(snapToGrid({ x: 12, y: 18 }, 5)).toEqual({ x: 10, y: 20 });
  });
});

describe('edgeLengths e setEdgeLength', () => {
  const rect = rectRing(0, 0, 300, 200);

  it('lista o comprimento de cada parede', () => {
    expect(edgeLengths(rect)).toEqual([300, 200, 300, 200]);
  });

  it('mudar uma parede de um retângulo move a parede oposta junto', () => {
    const r = setEdgeLength(rect, 0, 350);
    expect(edgeLengths(r)).toEqual([350, 200, 350, 200]);
    expect(polygonArea(r)).toBe(350 * 200);
    const r2 = setEdgeLength(rect, 1, 150);
    expect(bbox(r2)).toEqual({ x: 0, y: 0, w: 300, h: 150 });
  });

  it('no cômodo em L, move a linha de parede inteira', () => {
    const l: Ring = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 150 },
      { x: 400, y: 150 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    const r = setEdgeLength(l, 2, 250); // parede de baixo do braço direito: 200 → 250
    expect(edgeLengths(r)).toEqual([200, 150, 250, 150, 450, 300]);
  });

  it('parede inclinada: só a ponta final anda', () => {
    const t: Ring = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 0, y: 400 },
    ];
    const r = setEdgeLength(t, 1, 250); // hipotenusa 500 → 250
    expect(edgeLengths(r)[1]).toBeCloseTo(250);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[1]).toEqual({ x: 300, y: 0 });
  });
});

describe('snapToGeometry (ímã de pontos, guias e paredes)', () => {
  const room = rectRing(0, 0, 300, 200);

  it('conecta no canto de outro cômodo quando chega perto', () => {
    const s = snapToGeometry({ x: 304, y: 197 }, [room], [], 8);
    expect(s.kind).toBe('vertex');
    expect(s.point).toEqual({ x: 300, y: 200 });
  });

  it('alinha com um canto (guia) quando só uma coordenada está perto', () => {
    const s = snapToGeometry({ x: 297, y: 420 }, [room], [], 8);
    expect(s.kind).toBe('align');
    expect(s.point).toEqual({ x: 300, y: 420 });
    expect(s.guides).toHaveLength(1);
  });

  it('encosta na parede quando está perto dela, longe dos cantos', () => {
    const s = snapToGeometry({ x: 150, y: 205 }, [room], [], 8);
    expect(s.kind).toBe('edge');
    expect(s.point).toEqual({ x: 150, y: 200 });
  });

  it('pontos extras (o próprio desenho) também puxam', () => {
    const s = snapToGeometry({ x: 503, y: 498 }, [], [{ x: 500, y: 500 }], 8);
    expect(s.point).toEqual({ x: 500, y: 500 });
  });

  it('longe de tudo, fica onde está', () => {
    expect(snapToGeometry({ x: 700, y: 700 }, [room], [], 8)).toEqual({ point: { x: 700, y: 700 }, kind: null, guides: [] });
  });

  it('com eixo travado, só alinha a coordenada livre', () => {
    // parede horizontal sendo desenhada em y = 420: só o x pode alinhar
    const s = snapToGeometry({ x: 297, y: 420 }, [room], [], 8, 'x');
    expect(s.point).toEqual({ x: 300, y: 420 });
    const v = snapToGeometry({ x: 297, y: 203 }, [room], [], 8, 'x');
    expect(v.point.y).toBe(203);
  });
});

describe('cômodos retangulares', () => {
  it('translateRing desloca todos os pontos', () => {
    expect(translateRing(rectRing(0, 0, 10, 10), 5, -2)[0]).toEqual({ x: 5, y: -2 });
  });

  it('placeBeside põe o novo cômodo à direita dos existentes, com a parede entre eles', () => {
    expect(placeBeside([rectRing(0, 0, 300, 200)], 15)).toEqual({ x: 315, y: 0 });
    expect(placeBeside([], 15)).toEqual({ x: 0, y: 0 });
  });

  it('snapMove encaixa ao lado do vizinho (deixando a parede) e alinha o topo', () => {
    const d = snapMove(rectRing(0, 0, 100, 100), [rectRing(200, 0, 100, 100)], { x: 88, y: 3 }, 15, 10);
    expect(d).toEqual({ x: 85, y: 0 });
  });

  it('snapMove não mexe quando nada está perto', () => {
    expect(snapMove(rectRing(0, 0, 100, 100), [rectRing(500, 500, 100, 100)], { x: 40, y: 30 }, 15, 10)).toEqual({ x: 40, y: 30 });
  });
});
