import { useEffect, useState } from 'react';

/** Toque como entrada principal (celular, tablet): as dicas falam em dedos, não em mouse. */
export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Dica de uso sobre a planta. No computador fica aberta e deixa os cliques passarem; no
 * celular vira uma linha que abre com um toque, para não cobrir a planta.
 */
export default function Hint({ children }: { children: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [children]);
  return (
    <button type="button" className={`hint${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      {children}
    </button>
  );
}
