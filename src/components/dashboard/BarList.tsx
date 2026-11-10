/** A simple, accessible bar chart: every bar also shows its number as text. */
export function BarList({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2">
          <span className="truncate text-sm">{i.label}</span>
          <span className="h-5 rounded bg-line" aria-hidden="true">
            <span className="block h-5 rounded bg-brand" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="text-end font-bold">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
