"use client";
import "katex/dist/katex.min.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkAnswer, saveProgress, submitQuiz, type CheckResult } from "@/lib/actions/quiz";
import { countBlanks, type Choice, type MatchingChoices, type PublicQuestion, type Response } from "@/lib/quiz/types";
import { MathText, speakable } from "./MathText";
import { cn } from "@/lib/cn";

export type PlayerLabels = Record<
  | "questionOf" | "readAloud" | "stopReading" | "hint" | "check" | "next" | "back" | "finish" | "finishing" | "saved" | "saving"
  | "true" | "false" | "yourAnswer" | "blank" | "chooseMatch" | "tryAgain" | "notQuite" | "explanation" | "timeLeft" | "oneMinute"
  | "unanswered" | "offlineSaved" | "pickAll" | "typeNumber",
  string
> & { cheers: string[] };

type Result = { correct: boolean; final?: boolean };

export function QuizPlayer({
  attemptId, title, questions, initialResponses, initialResults, initialIndex, instantFeedback, timeLimitMinutes, startedAt, speechLang, labels, resultsHref,
}: {
  attemptId: string; title: string; questions: PublicQuestion[]; initialResponses: Record<string, Response>; initialResults: Record<string, Result>;
  initialIndex: number; instantFeedback: boolean; timeLimitMinutes: number | null; startedAt: string; speechLang: string; labels: PlayerLabels; resultsHref: string;
}) {
  const storageKey = `quiz:${attemptId}`;
  const [index, setIndex] = useState(Math.min(initialIndex, questions.length - 1));
  const [responses, setResponses] = useState<Record<string, Response>>(initialResponses);
  const [results, setResults] = useState<Record<string, Result>>(initialResults);
  const [feedback, setFeedback] = useState<Record<string, CheckResult>>({});
  const [showHint, setShowHint] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const q = questions[index];
  const locked = Boolean(results[q.id]?.final);

  // Bring back answers saved on this device (e.g. if the connection dropped).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as { responses: Record<string, Response> } | null;
      if (saved?.responses) setResponses((r) => ({ ...saved.responses, ...r }));
    } catch { /* ignore */ }
  }, [storageKey]);

  // Auto-save (debounced): to this device right away, to the server shortly after.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: Record<string, Response>, idx: number) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ responses: next })); } catch { /* ignore */ }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!navigator.onLine) return setStatus("offline");
      setStatus("saving");
      const r = await saveProgress(attemptId, next, idx).catch(() => ({ ok: false }));
      setStatus(r.ok ? "saved" : "offline");
    }, 800);
  }, [attemptId, storageKey]);

  function answer(value: Response) {
    if (locked) return;
    const next = { ...responses, [q.id]: value };
    setResponses(next);
    persist(next, index);
  }

  function go(to: number) {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setShowHint(false);
    setIndex(to);
    persist(responses, to);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function check() {
    setBusy(true);
    const r = await checkAnswer(attemptId, q.id, responses[q.id]).catch(() => null);
    setBusy(false);
    if (!r) return;
    setFeedback((f) => ({ ...f, [q.id]: r }));
    if (r.final) setResults((x) => ({ ...x, [q.id]: { correct: r.correct, final: true } }));
  }

  const finish = useCallback(async (force = false) => {
    const unanswered = questions.filter((x) => !hasAnswer(responses[x.id])).length;
    if (!force && unanswered && !window.confirm(labels.unanswered.replace("{count}", String(unanswered)))) return;
    setBusy(true);
    const r = await submitQuiz(attemptId, responses).catch(() => ({ ok: false }));
    if (r.ok) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      window.location.assign(resultsHref);
    } else {
      setBusy(false);
      setStatus("offline");
    }
  }, [attemptId, questions, responses, labels.unanswered, resultsHref, storageKey]);

  // Optional timer (off unless the tutor turned it on).
  const deadline = timeLimitMinutes ? new Date(startedAt).getTime() + timeLimitMinutes * 60_000 : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const left = deadline ? Math.max(0, deadline - now) : null;
  const firedRef = useRef(false);
  useEffect(() => {
    if (left === 0 && !firedRef.current) {
      firedRef.current = true;
      void finish(true);
    }
  }, [left, finish]);

  function readAloud() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const parts = [q.prompt];
    if (Array.isArray(q.choices)) parts.push(...(q.choices as Choice[]).map((c, i) => `${String.fromCharCode(65 + i)}. ${c.text}`));
    if (q.type === "true_false") parts.push(labels.true, labels.false);
    if (q.type === "matching") parts.push(...(q.choices as MatchingChoices).left.map((c) => c.text));
    const u = new SpeechSynthesisUtterance(speakable(parts.join(". ")));
    u.lang = speechLang;
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  const fb = feedback[q.id];
  const cheer = useMemo(() => labels.cheers[Math.floor(Math.random() * labels.cheers.length)], [labels.cheers, fb]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = Math.round(((index + 1) / questions.length) * 100);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold text-muted">{title}</p>
      {/* Progress */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-bold">{labels.questionOf.replace("{n}", String(index + 1)).replace("{total}", String(questions.length))}</p>
        {left !== null ? (
          <p className={cn("rounded-full px-3 py-1 font-bold", left < 60_000 ? "bg-danger-soft text-danger" : "bg-brand-soft")} aria-label={labels.timeLeft}>
            ⏱ {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}
          </p>
        ) : null}
      </div>
      <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={index + 1} aria-label={labels.questionOf.replace("{n}", String(index + 1)).replace("{total}", String(questions.length))}>
        <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="sr-only" aria-live="polite">{left !== null && left < 60_000 && left > 55_000 ? labels.oneMinute : ""}</p>

      <section className="mt-5 rounded-2xl border-2 border-line bg-white p-5" aria-labelledby="q-prompt">
        <div className="flex items-start justify-between gap-3">
          <h1 id="q-prompt" ref={headingRef} tabIndex={-1} className="text-xl font-bold leading-relaxed outline-none sm:text-2xl">
            <MathText text={q.prompt} />
          </h1>
          <button type="button" onClick={readAloud} aria-pressed={speaking}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border-2 border-brand px-3 font-semibold text-brand">
            <span aria-hidden="true">{speaking ? "⏹" : "🔊"}</span> {speaking ? labels.stopReading : labels.readAloud}
          </button>
        </div>
        {q.image_url ? <img src={q.image_url} alt="" className="mt-3 max-h-72 w-auto rounded-lg" loading="lazy" /> : null}

        <div className="mt-5">
          <AnswerInput q={q} value={responses[q.id]} onChange={answer} disabled={locked} labels={labels} />
        </div>

        {q.hint ? (
          <div className="mt-4">
            {showHint || (fb && !fb.final) ? (
              <p className="rounded-xl bg-sun-soft p-3"><span aria-hidden="true">💡 </span><strong>{labels.hint}:</strong> <MathText text={q.hint} /></p>
            ) : (
              <button type="button" onClick={() => setShowHint(true)} className="inline-flex min-h-11 items-center font-semibold text-brand underline">
                💡 {labels.hint}
              </button>
            )}
          </div>
        ) : null}

        <div aria-live="polite" className="mt-4">
          {fb ? (
            fb.correct ? (
              <div className="rounded-xl border-l-8 border-leaf bg-leaf-soft p-4">
                <p className="text-lg font-bold">🎉 {cheer}</p>
                {fb.explanation ? <p className="mt-1"><MathText text={fb.explanation} /></p> : null}
              </div>
            ) : fb.final ? (
              <div className="rounded-xl border-l-8 border-coral bg-sun-soft p-4">
                <p className="text-lg font-bold">💛 {labels.notQuite}</p>
                {fb.explanation ? <p className="mt-1"><strong>{labels.explanation}:</strong> <MathText text={fb.explanation} /></p> : null}
              </div>
            ) : (
              <p className="rounded-xl border-l-8 border-coral bg-sun-soft p-4 text-lg font-bold">🤔 {labels.tryAgain}</p>
            )
          ) : null}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0}
          className="inline-flex min-h-14 min-w-28 items-center justify-center rounded-xl border-2 border-ink px-5 text-lg font-semibold disabled:opacity-40">
          ← {labels.back}
        </button>
        {instantFeedback && !locked && hasAnswer(responses[q.id]) ? (
          <button type="button" onClick={check} disabled={busy}
            className="inline-flex min-h-14 items-center justify-center rounded-xl bg-coral px-6 text-lg font-bold text-white disabled:opacity-60">
            ✔ {labels.check}
          </button>
        ) : null}
        {index < questions.length - 1 ? (
          <button type="button" onClick={() => go(index + 1)}
            className="inline-flex min-h-14 min-w-28 items-center justify-center rounded-xl bg-brand px-6 text-lg font-bold text-white">
            {labels.next} →
          </button>
        ) : (
          <button type="button" onClick={() => finish()} disabled={busy}
            className="inline-flex min-h-14 items-center justify-center rounded-xl bg-leaf px-6 text-lg font-bold text-white disabled:opacity-60">
            {busy ? labels.finishing : `🏁 ${labels.finish}`}
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-muted" role="status">
        {status === "saving" ? labels.saving : status === "saved" ? `✓ ${labels.saved}` : status === "offline" ? `⚠ ${labels.offlineSaved}` : ""}
      </p>
    </div>
  );
}

function hasAnswer(v: Response) {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.some((x) => String(x).trim() !== "");
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

const bigOption =
  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong bg-white px-4 py-3 text-lg has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:disabled]:cursor-default";

function AnswerInput({ q, value, onChange, disabled, labels }: {
  q: PublicQuestion; value: Response; onChange: (v: Response) => void; disabled: boolean; labels: PlayerLabels;
}) {
  const name = `q-${q.id}`;
  switch (q.type) {
    case "multiple_choice":
      return (
        <fieldset><legend className="sr-only">{labels.yourAnswer}</legend>
          <div className="grid gap-2">
            {(q.choices as Choice[]).map((c, i) => (
              <label key={c.id} className={bigOption}>
                <input type="radio" name={name} className="size-6" checked={value === c.id} disabled={disabled} onChange={() => onChange(c.id)} />
                <span aria-hidden="true" className="font-bold">{String.fromCharCode(65 + i)}.</span> <MathText text={c.text} />
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "multiple_select": {
      const set = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <fieldset><legend className="mb-2 font-semibold text-muted">{labels.pickAll}</legend>
          <div className="grid gap-2">
            {(q.choices as Choice[]).map((c) => (
              <label key={c.id} className={bigOption}>
                <input type="checkbox" className="size-6" checked={set.has(c.id)} disabled={disabled}
                  onChange={(e) => { const n = new Set(set); if (e.target.checked) n.add(c.id); else n.delete(c.id); onChange([...n]); }} />
                <MathText text={c.text} />
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "true_false":
      return (
        <fieldset><legend className="sr-only">{labels.yourAnswer}</legend>
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((b) => (
              <label key={String(b)} className={cn(bigOption, "justify-center text-xl font-bold")}>
                <input type="radio" name={name} className="size-6" checked={value === b} disabled={disabled} onChange={() => onChange(b)} />
                {b ? `👍 ${labels.true}` : `👎 ${labels.false}`}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "short_answer":
    case "numeric":
      return (
        <div>
          <label htmlFor={name} className="mb-1 block font-semibold">{q.type === "numeric" ? labels.typeNumber : labels.yourAnswer}</label>
          <input id={name} type="text" inputMode={q.type === "numeric" ? "decimal" : "text"} autoComplete="off" spellCheck={q.type !== "numeric"}
            value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}
            className="block w-full min-h-14 rounded-xl border-2 border-line-strong px-4 text-xl" />
        </div>
      );
    case "fill_blank": {
      const n = countBlanks(q.prompt);
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="grid gap-3">
          {Array.from({ length: n }, (_, i) => (
            <div key={i}>
              <label htmlFor={`${name}-${i}`} className="mb-1 block font-semibold">{labels.blank.replace("{n}", String(i + 1))}</label>
              <input id={`${name}-${i}`} type="text" autoComplete="off" value={arr[i] ?? ""} disabled={disabled}
                onChange={(e) => { const next = Array.from({ length: n }, (_, k) => arr[k] ?? ""); next[i] = e.target.value; onChange(next); }}
                className="block w-full min-h-14 rounded-xl border-2 border-line-strong px-4 text-xl" />
            </div>
          ))}
        </div>
      );
    }
    case "matching": {
      const m = q.choices as MatchingChoices;
      const map = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
      return (
        <div className="grid gap-3">
          {m.left.map((l) => (
            <div key={l.id} className="grid items-center gap-2 rounded-xl border-2 border-line p-3 sm:grid-cols-2">
              <label htmlFor={`${name}-${l.id}`} className="text-lg font-semibold"><MathText text={l.text} /></label>
              <select id={`${name}-${l.id}`} value={map[l.id] ?? ""} disabled={disabled}
                onChange={(e) => { const next = { ...map }; if (e.target.value) next[l.id] = e.target.value; else delete next[l.id]; onChange(next); }}
                className="min-h-12 rounded-lg border-2 border-line-strong bg-white px-3 text-lg">
                <option value="">{labels.chooseMatch}</option>
                {m.right.map((r) => <option key={r.id} value={r.id}>{r.text.replace(/\$/g, "")}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
  }
}
