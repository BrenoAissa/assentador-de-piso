import { describe, expect, it } from 'vitest';
import { layout, rectRing, rectRoom, tile } from '../tiling/testUtils';
import { floorsTouch, ringsTouch } from './touch';

describe('ringsTouch (cômodos encostados, sem parede)', () => {
  it('lado a lado, dividindo uma borda: encostam', () => {
    expect(ringsTouch(rectRing(0, 0, 300, 300), rectRing(300, 0, 300, 300))).toBe(true);
  });

  it('com 15 cm de parede entre eles: não encostam', () => {
    expect(ringsTouch(rectRing(0, 0, 300, 300), rectRing(315, 0, 300, 300))).toBe(false);
  });

  it('só um canto em comum: não encostam', () => {
    expect(ringsTouch(rectRing(0, 0, 300, 300), rectRing(300, 300, 300, 300))).toBe(false);
  });

  it('deslocados, mas com 150 cm de borda em comum: encostam', () => {
    expect(ringsTouch(rectRing(0, 0, 300, 300), rectRing(300, 150, 300, 300))).toBe(true);
  });

  it('tolerância de 1 cm para desenho à mão', () => {
    expect(ringsTouch(rectRing(0, 0, 300, 300), rectRing(300.8, 0, 300, 300))).toBe(true);
  });
});

describe('floorsTouch', () => {
  const a = rectRoom('cozinha', 0, 0, 300, 300);
  const b = rectRoom('sala', 300, 0, 300, 300);
  it('cômodos encostados no mesmo piso não contam', () => {
    expect(floorsTouch([{ id: 'p1', tile: tile(), layout: layout(), rooms: [a, b] }])).toBe(false);
  });

  it('cômodos encostados em pisos diferentes contam', () => {
    expect(
      floorsTouch([
        { id: 'p1', tile: tile(), layout: layout(), rooms: [a] },
        { id: 'p2', tile: tile(), layout: layout(), rooms: [b] },
      ]),
    ).toBe(true);
  });
});
