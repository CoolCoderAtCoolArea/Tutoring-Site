"use client";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** What every server action used with <ActionForm> returns. */
export type FormState = { ok?: boolean; message?: string; errors?: string[]; redirectTo?: string } | null;

const SKIP = new Set(["password", "website", "pin", "cf-turnstile-response"]);

/**
 * A form that:
 *  - sends to a Server Action and shows success / error messages,
 *  - saves what the person types on this device (localStorage) so nothing is
 *    lost if the page reloads or the connection drops,
 *  - warns when offline instead of failing silently.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  draftKey,
  successMessage,
  offlineMessage,
  restoredMessage,
  resetOnSuccess = true,
  className,
  submitClassName,
  encType,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel: ReactNode;
  pendingLabel: ReactNode;
  draftKey?: string;
  successMessage?: string;
  offlineMessage?: string;
  restoredMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
  encType?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);
  const storageKey = draftKey ? `draft:${draftKey}` : null;

  // Restore a saved draft once, when the form first appears.
  useEffect(() => {
    if (!storageKey || !formRef.current) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as Record<string, string | string[]> | null;
      if (!saved) return;
      let any = false;
      for (const el of Array.from(formRef.current.elements) as HTMLInputElement[]) {
        if (!el.name || SKIP.has(el.name) || !(el.name in saved)) continue;
        const v = saved[el.name];
        if (el.type === "checkbox" || el.type === "radio") {
          el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value;
        } else if (el.type !== "file" && el.type !== "hidden") {
          el.value = String(v);
          if (v) any = true;
        }
      }
      if (any) setRestored(true);
    } catch {
      /* ignore broken drafts */
    }
  }, [storageKey]);

  function saveDraft() {
    if (!storageKey || !formRef.current) return;
    const data: Record<string, string | string[]> = {};
    for (const el of Array.from(formRef.current.elements) as HTMLInputElement[]) {
      if (!el.name || SKIP.has(el.name) || el.type === "file" || el.type === "hidden") continue;
      if (el.type === "checkbox") {
        const list = (data[el.name] as string[]) || [];
        if (el.checked) list.push(el.value);
        data[el.name] = list;
      } else if (el.type === "radio") {
        if (el.checked) data[el.name] = el.value;
      } else data[el.name] = el.value;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* storage full or private mode */
    }
  }

  useEffect(() => {
    if (state?.ok) {
      if (storageKey) localStorage.removeItem(storageKey);
      if (resetOnSuccess) formRef.current?.reset();
      setRestored(false);
      if (state.redirectTo) window.location.assign(state.redirectTo);
    }
  }, [state, storageKey, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={saveDraft}
      onSubmit={(e) => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          e.preventDefault();
          saveDraft();
          setOffline(true);
        } else setOffline(false);
      }}
      className={className}
      encType={encType}
      noValidate={false}
    >
      {restored && restoredMessage ? <Alert tone="info">{restoredMessage}</Alert> : null}
      {offline && offlineMessage ? (
        <Alert tone="warning" live>
          {offlineMessage}
        </Alert>
      ) : null}
      {state && !state.ok && (state.message || state.errors?.length) ? (
        <Alert tone="error" live title={state.message}>
          {state.errors?.length ? (
            <ul className="list-disc ps-5">
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state?.ok && (state.message || successMessage) ? (
        <Alert tone="success" live>
          {state.message || successMessage}
        </Alert>
      ) : null}
      {children}
      <SubmitButton size="lg" pendingText={pendingLabel} className={submitClassName ?? "w-full sm:w-auto"}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
