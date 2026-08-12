/** Small caps step header: "01 · Ваши данные". */
export function StepLabel({ number, children }: { number: string; children: string }) {
  return (
    <p className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
      <span className="font-serif text-sm normal-case italic text-primary-dark">{number}</span>
      {children}
    </p>
  );
}
