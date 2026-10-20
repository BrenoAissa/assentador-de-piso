import { canAdvance, type Step } from '../store/issues';
import { useProject } from '../store/project';

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Planta' },
  { n: 2, label: 'Cômodos' },
  { n: 3, label: 'Piso' },
  { n: 4, label: 'Resultado' },
];

/** Um passo é alcançável quando todos os anteriores estão completos. */
export function blockerBefore(project: Parameters<typeof canAdvance>[0], step: Step): string | null {
  for (let s = 1; s < step; s++) {
    const r = canAdvance(project, s as Step);
    if (!r.ok) return r.reason ?? 'Complete o passo anterior.';
  }
  return null;
}

export default function Stepper() {
  const project = useProject((s) => s.project);
  const step = useProject((s) => s.step);
  const setStep = useProject((s) => s.setStep);

  return (
    <nav aria-label="Passos" className="stepper-nav">
      <ol className="stepper">
        {STEPS.map(({ n, label }) => {
          const blocker = n === step ? null : blockerBefore(project, n);
          return (
            <li key={n}>
              <button
                className="step-btn"
                aria-current={n === step ? 'step' : undefined}
                disabled={!!blocker}
                title={blocker ?? label}
                onClick={() => setStep(n)}
              >
                <span className="num">{n}</span>
                <span className="label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
