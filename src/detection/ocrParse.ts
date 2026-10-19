const num = (s: string) => parseFloat(s.replace(',', '.'));

/** "3,20 x 4,50" → { a: 3.2, b: 4.5 } (metros). Exige casas decimais para evitar falsos positivos. */
export function parseDims(s: string): { a: number; b: number } | null {
  const m = s.match(/(\d{1,2}[.,]\d{1,2})\s*[xX×]\s*(\d{1,2}[.,]\d{1,2})/);
  return m ? { a: num(m[1]), b: num(m[2]) } : null;
}

/** "12,5 m²" / "12,50m2" → 12.5 */
export function parseArea(s: string): number | null {
  const m = s.match(/(\d{1,3}[.,]\d{1,2})\s*m\s*[²2]/i);
  return m ? num(m[1]) : null;
}

/** Cota linear isolada, como "3.31" ou "2,41" (metros, sempre com 2 casas). */
export function parseLinear(s: string): number | null {
  const m = s.trim().match(/^\(?(\d{1,2}[.,]\d{2})\)?\s*m?$/i);
  if (!m) return null;
  const v = num(m[1]);
  return v > 0 && v <= 30 ? v : null;
}

const RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/\blavabo\b/, 'Lavabo'],
  [/(^|[^a-z])(banho|banheiro|bwc|wc|w\.\s*c\.?)([^a-z]|$)/, 'Banheiro'],
  [/\bsuite\b/, 'Suíte'],
  [/\b(dorm(?:itorio)?|quarto)\b\.?\s*(\d)?/, (m) => (m[2] ? `Quarto ${m[2]}` : 'Quarto')],
  [/(area de servico|a\.\s*servico|\ba\.\s*s\.|lavanderia|\bservico\b)/, 'Área de serviço'],
  [/\b(cozinha|coz)\b/, 'Cozinha'],
  [/\b(sala|estar|jantar|living)\b/, 'Sala'],
  [/\b(varanda|sacada|terraco|balcao)\b/, 'Varanda'],
  [/\b(circulacao|circ|hall|corredor)\b/, 'Circulação'],
  [/\bescritorio\b/, 'Escritório'],
  [/\bcloset\b/, 'Closet'],
];

/** Nome de cômodo reconhecido no texto da planta, ou null. */
export function matchRoomName(s: string): string | null {
  const t = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  for (const [re, name] of RULES) {
    const m = t.match(re);
    if (m) return typeof name === 'string' ? name : name(m);
  }
  return null;
}
