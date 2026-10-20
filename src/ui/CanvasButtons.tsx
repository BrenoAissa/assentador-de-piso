/** Enquadrar a planta: ícone e texto; no celular, só o ícone. */
export function FitButton({ onClick }: { onClick(): void }) {
  return (
    <button className="tool tool-icon" onClick={onClick} title="Enquadrar a planta" aria-label="Enquadrar a planta">
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="long">Enquadrar</span>
    </button>
  );
}

/** Liga e desliga o ímã (cantos, paredes, guias, ângulo reto). */
export function MagnetButton({ on, onClick, title }: { on: boolean; onClick(): void; title?: string }) {
  return (
    <button
      className="tool tool-icon"
      aria-pressed={on}
      onClick={onClick}
      aria-label="Ímã"
      title={title ?? 'Ímã: encaixa em cantos, paredes, guias e ângulo reto. Segure Shift para mexer livre na hora.'}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M5 3v7a5 5 0 0 0 10 0V3" fill="none" stroke="currentColor" strokeWidth="2.6" />
        <path d="M5 3v3M15 3v3" stroke="#d9493b" strokeWidth="2.8" />
      </svg>
      <span className="long">Ímã</span>
    </button>
  );
}
