import { describe, expect, it } from 'vitest';
import { topViewDistance } from './snapshot';

describe('topViewDistance', () => {
  it('cabe a largura numa imagem larga e a altura numa imagem alta', () => {
    const fov = 30;
    const half = Math.tan((fov * Math.PI) / 360);
    // imagem quadrada, planta 1000 × 500: quem manda é a largura
    const d = topViewDistance(1000, 500, 1, fov, 1);
    expect(d * half * 2).toBeCloseTo(1000, 3);
    // imagem 2:1, planta 1000 × 800: quem manda é a altura
    const d2 = topViewDistance(1000, 800, 2, fov, 1);
    expect(d2 * half * 2).toBeCloseTo(800, 3);
  });

  it('a margem afasta a câmera', () => {
    expect(topViewDistance(1000, 500, 1, 30, 1.1)).toBeGreaterThan(topViewDistance(1000, 500, 1, 30, 1));
  });
});
