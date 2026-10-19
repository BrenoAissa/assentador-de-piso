import { describe, expect, it } from 'vitest';
import { matchRoomName, parseArea, parseDims, parseLinear } from './ocrParse';

describe('parseDims', () => {
  it('lê medidas com vírgula, ponto, x e ×', () => {
    expect(parseDims('3,20 x 4,50')).toEqual({ a: 3.2, b: 4.5 });
    expect(parseDims('3.2X4.5')).toEqual({ a: 3.2, b: 4.5 });
    expect(parseDims('SALA 3,20 × 4,50')).toEqual({ a: 3.2, b: 4.5 });
  });

  it('ignora textos sem medidas', () => {
    expect(parseDims('COZINHA')).toBeNull();
    expect(parseDims('12,5 m²')).toBeNull();
  });
});

describe('parseArea', () => {
  it('lê áreas em m² e m2', () => {
    expect(parseArea('12,5 m²')).toBe(12.5);
    expect(parseArea('12,50m2')).toBe(12.5);
    expect(parseArea('A=8.40 M2')).toBe(8.4);
  });

  it('ignora textos sem área', () => {
    expect(parseArea('3,20 x 4,50')).toBeNull();
  });
});

describe('parseLinear', () => {
  it('lê cotas lineares em metros', () => {
    expect(parseLinear('3.31')).toBe(3.31);
    expect(parseLinear('2,41')).toBe(2.41);
    expect(parseLinear('(0.96)')).toBe(0.96);
    expect(parseLinear('1.20m')).toBe(1.2);
  });

  it('ignora o que não é cota linear', () => {
    expect(parseLinear('12,5 m²')).toBeNull();
    expect(parseLinear('1:100')).toBeNull();
    expect(parseLinear('2021')).toBeNull();
    expect(parseLinear('3,20 x 4,50')).toBeNull();
    expect(parseLinear('3.3')).toBeNull();
  });
});

describe('matchRoomName', () => {
  it('reconhece nomes comuns de plantas', () => {
    expect(matchRoomName('DORM. 1')).toBe('Quarto 1');
    expect(matchRoomName('SUÍTE')).toBe('Suíte');
    expect(matchRoomName('Estar/Jantar')).toBe('Sala');
    expect(matchRoomName('A. SERVIÇO')).toBe('Área de serviço');
    expect(matchRoomName('W.C.')).toBe('Banheiro');
    expect(matchRoomName('LAVABO')).toBe('Lavabo');
    expect(matchRoomName('COZ.')).toBe('Cozinha');
    expect(matchRoomName('CIRCULAÇÃO')).toBe('Circulação');
  });

  it('não inventa nome para texto qualquer', () => {
    expect(matchRoomName('3,20 x 4,50')).toBeNull();
    expect(matchRoomName('ESCALA 1:100')).toBeNull();
  });
});
