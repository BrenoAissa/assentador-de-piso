import { describe, expect, it } from 'vitest';
import { layout, tile } from './testUtils';
import { validateTile } from './validate';

describe('validateTile', () => {
  it('padrões são válidos', () => {
    expect(validateTile(tile(), layout())).toEqual([]);
  });

  it('medida zero, negativa ou vazia', () => {
    const msg = 'Informe o comprimento e a largura da peça.';
    expect(validateTile(tile({ lengthCm: 0 }), layout())).toContain(msg);
    expect(validateTile(tile({ widthCm: -5 }), layout())).toContain(msg);
    expect(validateTile(tile({ lengthCm: NaN }), layout())).toContain(msg);
  });

  it('peça menor que 2 cm', () => {
    expect(validateTile(tile({ lengthCm: 1.5, widthCm: 1.5 }), layout())).toContain(
      'Peças menores que 2 cm não são suportadas.',
    );
  });

  it('rejunte negativo', () => {
    expect(validateTile(tile({ jointMm: -1 }), layout())).toContain('O rejunte não pode ser negativo.');
  });

  it('caixa sem peças nem m²', () => {
    const msg = 'Informe quantas peças vêm por caixa (ou quantos m²).';
    expect(validateTile(tile({ piecesPerBox: 0 }), layout())).toContain(msg);
    expect(validateTile(tile({ piecesPerBox: 0, m2PerBox: 1.44 }), layout())).not.toContain(msg);
  });

  it('margem de perda fora de 0–50%', () => {
    const msg = 'A margem de perda deve ficar entre 0% e 50%.';
    expect(validateTile(tile({ wastePct: -1 }), layout())).toContain(msg);
    expect(validateTile(tile({ wastePct: 60 }), layout())).toContain(msg);
  });

  it('deslocamento da amarração em cm fora da peça', () => {
    const msg = 'O deslocamento da amarração deve ser maior que 0 e menor que o comprimento da peça.';
    const l = (value: number) => layout({ pattern: 'running', runningOffset: { kind: 'cm', value } });
    expect(validateTile(tile(), l(0))).toContain(msg);
    expect(validateTile(tile(), l(60))).toContain(msg);
    expect(validateTile(tile(), l(20))).not.toContain(msg);
  });

  it('limite de filete inválido', () => {
    const msg = 'O limite de filete deve ficar entre 0 e metade da peça.';
    expect(validateTile(tile(), layout({ minCutFraction: 0.8 }))).toContain(msg);
    expect(validateTile(tile(), layout({ minCutCm: -2 }))).toContain(msg);
  });
});
