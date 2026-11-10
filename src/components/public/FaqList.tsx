/** FAQ using native <details>, which works with keyboards and screen readers without extra code. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-lg font-semibold">
            {item.q}
            <span aria-hidden="true" className="text-2xl transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="px-5 pb-5">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
