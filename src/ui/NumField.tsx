import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number | undefined;
  onChange(v: number): void;
  suffix?: string;
  /** Campo opcional: vazio vira NaN para quem chama decidir. */
  optional?: boolean;
  placeholder?: string;
}

/** Campo numérico que aceita vírgula e não "pula" para 0 enquanto o usuário apaga. */
export default function NumField({ label, value, onChange, suffix, optional, placeholder }: Props) {
  const shown =
    value === undefined || Number.isNaN(value)
      ? ''
      : value.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 3 });
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(shown);
  }, [shown, focused]);

  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input
          className="input"
          inputMode="decimal"
          value={text}
          placeholder={placeholder ?? (optional ? 'opcional' : undefined)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value.replace(',', '.'));
            onChange(Number.isNaN(v) ? NaN : v);
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
    </label>
  );
}
