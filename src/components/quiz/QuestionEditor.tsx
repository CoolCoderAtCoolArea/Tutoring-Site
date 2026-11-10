"use client";
import "katex/dist/katex.min.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveQuestion } from "@/lib/actions/quiz";
import { FileUpload } from "@/components/forms/FileUpload";
import { QUESTION_TYPES, countBlanks, type AnswerKey, type Choice, type MatchingChoices, type QuestionType } from "@/lib/quiz/types";
import { MathText } from "./MathText";

export type EditorLabels = Record<string, string> & { types: Record<QuestionType, string> };
export type EditableQuestion = {
  id: string; type: QuestionType; prompt: string; image_url: string | null; choices: Choice[] | MatchingChoices;
  hint: string | null; points: number; answer: AnswerKey; explanation: string | null;
};

const letters = "abcdefgh";
const input = "block w-full min-h-12 rounded-lg border-2 border-line-strong bg-white px-3 py-2";

/** Add or edit one quiz question. Works for every question type. */
export function QuestionEditor({ quizId, tutorId, question, labels, uploadLabels }: {
  quizId: string; tutorId: string; question?: EditableQuestion; labels: EditorLabels;
  uploadLabels: { uploading: string; remove: string; tooBig: string; badType: string; failed: string; takePhoto: string };
}) {
  const router = useRouter();
  const q = question;
  const a = (q?.answer ?? {}) as Record<string, unknown>;
  const [type, setType] = useState<QuestionType>(q?.type ?? "multiple_choice");
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [image, setImage] = useState<string | null>(q?.image_url ?? null);
  const [hint, setHint] = useState(q?.hint ?? "");
  const [explanation, setExplanation] = useState(q?.explanation ?? "");
  const [points, setPoints] = useState(q?.points ?? 1);
  const [choices, setChoices] = useState<string[]>(Array.isArray(q?.choices) && q.choices.length ? (q.choices as Choice[]).map((c) => c.text) : ["", "", ""]);
  const [correct, setCorrect] = useState<number[]>(() => {
    if (!Array.isArray(q?.choices)) return [];
    const ids = Array.isArray(a.correct) ? (a.correct as string[]) : typeof a.correct === "string" ? [a.correct] : [];
    return ids.map((id) => (q!.choices as Choice[]).findIndex((c) => c.id === id)).filter((i) => i >= 0);
  });
  const [tf, setTf] = useState<boolean>(typeof a.correct === "boolean" ? a.correct : true);
  const [accepted, setAccepted] = useState(Array.isArray(a.accepted) ? (a.accepted as string[]).join("\n") : "");
  const [value, setValue] = useState(typeof a.value === "number" ? String(a.value) : "");
  const [tolerance, setTolerance] = useState(typeof a.tolerance === "number" ? String(a.tolerance) : "0");
  const [blanks, setBlanks] = useState<string[]>(Array.isArray(a.blanks) ? (a.blanks as string[][]).map((b) => b.join("; ")) : []);
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>(() => {
    if (q?.type === "matching") {
      const m = q.choices as MatchingChoices;
      const p = (a.pairs ?? {}) as Record<string, string>;
      return m.left.map((l) => ({ left: l.text, right: m.right.find((r) => r.id === p[l.id])?.text ?? "" }));
    }
    return [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }];
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const nBlanks = countBlanks(prompt);

  function build() {
    const clean = choices.map((c) => c.trim()).filter(Boolean);
    const ch = clean.map((text, i) => ({ id: letters[i], text }));
    const base = { type, prompt, image_url: image, hint: hint || null, explanation: explanation || null, points: Number(points) || 0 };
    switch (type) {
      case "multiple_choice": return { ...base, choices: ch, answer: { correct: letters[correct[0] ?? -1] ?? "" } };
      case "multiple_select": return { ...base, choices: ch, answer: { correct: correct.filter((i) => i < ch.length).map((i) => letters[i]) } };
      case "true_false": return { ...base, choices: [], answer: { correct: tf } };
      case "short_answer": return { ...base, choices: [], answer: { accepted: accepted.split(/\n|,/).map((s) => s.trim()).filter(Boolean) } };
      case "numeric": return { ...base, choices: [], answer: { value: Number(value), tolerance: Math.abs(Number(tolerance) || 0) } };
      case "fill_blank": return { ...base, choices: [], answer: { blanks: Array.from({ length: nBlanks }, (_, i) => (blanks[i] ?? "").split(";").map((s) => s.trim()).filter(Boolean)) } };
      case "matching": {
        const good = pairs.filter((p) => p.left.trim() && p.right.trim());
        const left = good.map((p, i) => ({ id: `l${i + 1}`, text: p.left.trim() }));
        const right = good.map((p, i) => ({ id: `r${i + 1}`, text: p.right.trim() }));
        // Shuffle the right column so answers aren't in the same order.
        const shuffled = right.length > 1 ? [...right.slice(1), right[0]].reverse() : right;
        return { ...base, choices: { left, right: shuffled }, answer: { pairs: Object.fromEntries(left.map((l, i) => [l.id, right[i].id])) } };
      }
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await saveQuestion(quizId, q?.id ?? null, build());
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) {
      if (!q) { setPrompt(""); setHint(""); setExplanation(""); setChoices(["", "", ""]); setCorrect([]); setAccepted(""); setValue(""); setBlanks([]); setImage(null); setPairs([{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }]); }
      router.refresh();
    }
  }

  const uid = q?.id ?? "new";
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`type-${uid}`} className="mb-1 block font-semibold">{labels.type}</label>
        <select id={`type-${uid}`} className={input} value={type} onChange={(e) => setType(e.target.value as QuestionType)} disabled={Boolean(q)}>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{labels.types[t]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`prompt-${uid}`} className="mb-1 block font-semibold">{labels.prompt}</label>
        <textarea id={`prompt-${uid}`} className={input} rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-describedby={`prompt-hint-${uid}`} />
        <p id={`prompt-hint-${uid}`} className="mt-1 text-sm text-muted">{type === "fill_blank" ? labels.blankHelp : labels.mathHelp}</p>
        {prompt.includes("$") ? <div className="mt-2 rounded-lg bg-paper p-2"><span className="text-sm text-muted">{labels.preview}: </span><MathText text={prompt} /></div> : null}
      </div>

      <FileUpload bucket="quiz-images" folder={tutorId} name="image_url" label={labels.image} hint={labels.imageHint} accept="image/jpeg,image/png,image/webp" maxBytes={2 * 1024 * 1024} publicUrl
        labels={uploadLabels} initial={image ? [{ path: image, name: labels.currentImage, url: image }] : []} onChange={(f) => setImage(f[0]?.url ?? null)} />

      {type === "multiple_choice" || type === "multiple_select" ? (
        <fieldset>
          <legend className="mb-1 font-semibold">{labels.choices} — {type === "multiple_choice" ? labels.markOne : labels.markAll}</legend>
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type={type === "multiple_choice" ? "radio" : "checkbox"} name={`correct-${uid}`} className="size-6" aria-label={`${labels.correctChoice} ${i + 1}`}
                  checked={correct.includes(i)} onChange={(e) => setCorrect(type === "multiple_choice" ? [i] : e.target.checked ? [...correct, i] : correct.filter((x) => x !== i))} />
                <input className={input} value={c} aria-label={`${labels.choice} ${i + 1}`} onChange={(e) => setChoices(choices.map((x, k) => (k === i ? e.target.value : x)))} />
                {choices.length > 2 ? <button type="button" className="min-h-11 px-2 text-danger underline" onClick={() => { setChoices(choices.filter((_, k) => k !== i)); setCorrect(correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))); }}>{labels.remove}</button> : null}
              </div>
            ))}
          </div>
          {choices.length < 8 ? <button type="button" className="mt-2 min-h-11 font-semibold text-brand underline" onClick={() => setChoices([...choices, ""])}>+ {labels.addChoice}</button> : null}
        </fieldset>
      ) : null}

      {type === "true_false" ? (
        <fieldset><legend className="mb-1 font-semibold">{labels.correctAnswer}</legend>
          <div className="flex gap-3">
            {[true, false].map((b) => (
              <label key={String(b)} className="flex min-h-11 items-center gap-2 rounded-lg border-2 border-line-strong px-3">
                <input type="radio" name={`tf-${uid}`} checked={tf === b} onChange={() => setTf(b)} className="size-5" /> {b ? labels.true : labels.false}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {type === "short_answer" ? (
        <div>
          <label htmlFor={`acc-${uid}`} className="mb-1 block font-semibold">{labels.accepted}</label>
          <textarea id={`acc-${uid}`} className={input} rows={3} value={accepted} onChange={(e) => setAccepted(e.target.value)} />
          <p className="mt-1 text-sm text-muted">{labels.acceptedHelp}</p>
        </div>
      ) : null}

      {type === "numeric" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor={`val-${uid}`} className="mb-1 block font-semibold">{labels.number}</label><input id={`val-${uid}`} className={input} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div><label htmlFor={`tol-${uid}`} className="mb-1 block font-semibold">{labels.tolerance}</label><input id={`tol-${uid}`} className={input} inputMode="decimal" value={tolerance} onChange={(e) => setTolerance(e.target.value)} /><p className="mt-1 text-sm text-muted">{labels.toleranceHelp}</p></div>
        </div>
      ) : null}

      {type === "fill_blank" ? (
        nBlanks === 0 ? <p className="rounded-lg bg-sun-soft p-3">{labels.needBlanks}</p> : (
          <div className="space-y-2">
            {Array.from({ length: nBlanks }, (_, i) => (
              <div key={i}><label htmlFor={`blank-${uid}-${i}`} className="mb-1 block font-semibold">{labels.blankAnswer.replace("{n}", String(i + 1))}</label>
                <input id={`blank-${uid}-${i}`} className={input} value={blanks[i] ?? ""} onChange={(e) => { const n = [...blanks]; n[i] = e.target.value; setBlanks(n); }} /></div>
            ))}
            <p className="text-sm text-muted">{labels.blankAltHelp}</p>
          </div>
        )
      ) : null}

      {type === "matching" ? (
        <fieldset><legend className="mb-1 font-semibold">{labels.pairs}</legend>
          <div className="space-y-2">
            {pairs.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input className={input} aria-label={`${labels.left} ${i + 1}`} value={p.left} onChange={(e) => setPairs(pairs.map((x, k) => (k === i ? { ...x, left: e.target.value } : x)))} />
                <span aria-hidden="true">→</span>
                <input className={input} aria-label={`${labels.right} ${i + 1}`} value={p.right} onChange={(e) => setPairs(pairs.map((x, k) => (k === i ? { ...x, right: e.target.value } : x)))} />
              </div>
            ))}
          </div>
          {pairs.length < 10 ? <button type="button" className="mt-2 min-h-11 font-semibold text-brand underline" onClick={() => setPairs([...pairs, { left: "", right: "" }])}>+ {labels.addPair}</button> : null}
        </fieldset>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`hint-${uid}`} className="mb-1 block font-semibold">{labels.hint}</label><textarea id={`hint-${uid}`} className={input} rows={2} value={hint} onChange={(e) => setHint(e.target.value)} /></div>
        <div><label htmlFor={`exp-${uid}`} className="mb-1 block font-semibold">{labels.explanation}</label><textarea id={`exp-${uid}`} className={input} rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
      </div>
      <div className="max-w-40"><label htmlFor={`pts-${uid}`} className="mb-1 block font-semibold">{labels.points}</label><input id={`pts-${uid}`} type="number" min={0} max={100} className={input} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></div>

      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "font-semibold text-leaf" : "font-semibold text-danger"}>{msg.ok ? "✅" : "⚠"} {msg.text}</p> : null}
      <button type="button" onClick={save} disabled={busy} className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60">
        {busy ? labels.saving : q ? labels.saveQuestion : labels.addQuestion}
      </button>
    </div>
  );
}
