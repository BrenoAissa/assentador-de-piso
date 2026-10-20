import { describe, expect, it } from 'vitest';
import { floorSnap, rowSnap } from './snap';
import { layout, rectRoom, tile } from './testUtils';

const t60 = tile({ jointMm: 0 });

describe('floorSnap (ímã do piso nas paredes)', () => {
  it('gruda quando a borda da peça chega na face da parede', () => {
    // cômodo 310 de largura: peça inteira encostada na parede da direita quando ox ≡ 10 (mod 60)
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const s = floorSnap(rooms, t60, layout(), { x: 0, y: 0 }, { x: 13, y: 0 }, 5);
    expect(s.delta.x).toBeCloseTo(10);
    expect(s.guides.some((g) => g.a.x === 310 && g.b.x === 310)).toBe(true);
  });

  it('tolerância zero (mexer livre, Shift ou ímã desligado) não gruda', () => {
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const s = floorSnap(rooms, t60, layout(), { x: 0, y: 0 }, { x: 13, y: 0 }, 0);
    expect(s.delta).toEqual({ x: 13, y: 0 });
    expect(rowSnap(rectRoom('s', 0, 0, 310, 60), t60, layout(), { x: 0, y: 0 }, 0, 7, 0).extra).toBe(7);
  });

  it('não gruda quando está longe de qualquer encaixe', () => {
    const rooms = [rectRoom('sala', 0, 0, 310, 300)];
    const s = floorSnap(rooms, t60, layout(), { x: 0, y: 0 }, { x: 35, y: 27 }, 5);
    expect(s.delta).toEqual({ x: 35, y: 27 });
  });

  it('gruda também no eixo vertical, nas paredes de cima e de baixo', () => {
    const rooms = [rectRoom('sala', 0, 0, 300, 310)];
    const s = floorSnap(rooms, t60, layout(), { x: 0, y: 0 }, { x: 0, y: 12 }, 5);
    expect(s.delta.y).toBeCloseTo(10);
  });

  it('funciona com a peça em pé (rotação de 90°)', () => {
    const rooms = [rectRoom('quarto', 0, 0, 300, 310)];
    const t = tile({ lengthCm: 120, widthCm: 20, jointMm: 0 });
    // comprimento da régua no eixo y da planta: peça inteira na parede de baixo quando oy ≡ 310 − 120 = 190 ≡ 70 (mod 120)
    const s = floorSnap(rooms, t, layout({ rotationDeg: 90 }), { x: 0, y: 0 }, { x: 0, y: 66 }, 5);
    expect(s.delta.y).toBeCloseTo(70);
  });
});

describe('rowSnap (ímã da fileira nas paredes)', () => {
  it('gruda quando a ponta da fileira encosta na parede', () => {
    const room = rectRoom('sala', 0, 0, 310, 60);
    const s = rowSnap(room, t60, layout(), { x: 0, y: 0 }, 0, 7, 5);
    expect(s.extra).toBeCloseTo(10);
    expect(s.guides).toHaveLength(1);
  });

  it('não mexe quando está longe', () => {
    const room = rectRoom('sala', 0, 0, 310, 60);
    expect(rowSnap(room, t60, layout(), { x: 0, y: 0 }, 0, 30, 5).extra).toBe(30);
  });
});
