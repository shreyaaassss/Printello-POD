import { useEffect } from 'react';

interface Props {
  title: string;
  /** Which phase of the build plan fills this screen in. */
  phase: string;
}

/** Stand-in for a screen not yet built, so routing can be wired up front. */
export function PlaceholderPage({ title, phase }: Props) {
  useEffect(() => {
    document.title = `${title} | Printello POD`;
  }, [title]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-muted">Arrives in phase {phase}.</p>
    </div>
  );
}
