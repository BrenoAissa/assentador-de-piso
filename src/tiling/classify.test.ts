import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { layout, rectRing } from './testUtils';

const rect = { x: 0, y: 0, w: 60, h: 60 };
const l = layout();

describe('classify', () => {
  it('peça inteira', () => {
    expect(classify([rectRing(0, 0, 60, 60)], rect, 60, 60, l)).toEqual({ kind: 'full' });
  });

  it('recorte reto de 35 cm', () => {
    expect(classify([rectRing(0, 0, 35, 60)], rect, 60, 60, l)).toEqual({
      kind: 'cut',
      cutType: 'straight',
      cutSize: { w: 35, h: 60 },
    });
  });

  it('recorte de 10 cm é filete', () => {
    const c = classify([rectRing(0, 0, 10, 60)], rect, 60, 60, l);
    expect(c.kind).toBe('sliver');
    expect(c.cutType).toBe('straight');
  });

  it('recorte nos dois lados é canto', () => {
    const c = classify([rectRing(0, 0, 35, 40)], rect, 60, 60, l);
    expect(c.kind).toBe('cut');
    expect(c.cutType).toBe('corner');
    expect(c.cutSize).toEqual({ w: 35, h: 40 });
  });

  it('formato não retangular é irregular', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 0, y: 60 },
    ];
    expect(classify([tri], rect, 60, 60, l).cutType).toBe('shaped');
  });

  it('limite de filete usa a fração da peça quando é maior que o mínimo em cm', () => {
    // 1/3 de 60 = 20 cm: 19 cm é filete, 21 cm não
    expect(classify([rectRing(0, 0, 19, 60)], rect, 60, 60, l).kind).toBe('sliver');
    expect(classify([rectRing(0, 0, 21, 60)], rect, 60, 60, l).kind).toBe('cut');
  });
});
