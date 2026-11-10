import type { OpenSlot } from "@/lib/slots";
import { detroitDateKey, formatDay, formatTime } from "@/lib/time";

/**
 * Open times as big radio buttons, grouped by day. With "any tutor", times
 * offered by several tutors are shown once (the database picks a tutor).
 */
export function SlotPicker({ slots, locale, legend, showTutor, defaultValue }: {
  slots: OpenSlot[]; locale: string; legend: string; showTutor: boolean; defaultValue?: string;
}) {
  const unique = new Map<string, OpenSlot>();
  for (const s of slots) if (!unique.has(s.starts_at)) unique.set(s.starts_at, s);
  const byDay = new Map<string, OpenSlot[]>();
  for (const s of unique.values()) {
    const k = detroitDateKey(s.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const normalized = defaultValue ? new Date(defaultValue).toISOString() : undefined;
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-lg font-bold">{legend}</legend>
      <div className="space-y-4">
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day}>
            <p className="mb-1 font-semibold">{formatDay(list[0].starts_at, locale)}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((s) => (
                <label
                  key={s.starts_at}
                  className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line-strong bg-white px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                >
                  <input type="radio" name="slot" value={s.starts_at} required defaultChecked={new Date(s.starts_at).toISOString() === normalized} className="size-5" />
                  <span>
                    <span className="font-bold">{formatTime(s.starts_at, locale)}</span>
                    {showTutor ? <span className="block text-sm text-muted">{s.tutor_name}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
