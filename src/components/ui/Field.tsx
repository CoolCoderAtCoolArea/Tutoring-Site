import type { ComponentProps, ReactNode } from "react";
import Script from "next/script";
import { cn } from "@/lib/cn";

/**
 * Form fields with a visible label, optional hint, and error message.
 * The hint and error are connected with aria-describedby so screen readers read them.
 */
type Common = { label: ReactNode; name: string; hint?: ReactNode; error?: string; optionalText?: string };

const inputClass =
  "block w-full rounded-lg border-2 border-line-strong bg-white px-3 py-2.5 text-base text-ink " +
  "min-h-12 placeholder:text-muted aria-[invalid=true]:border-danger";

function Describe({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1 text-sm font-semibold text-danger">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      ) : null}
    </>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

function Label({ id, label, required, optionalText }: { id: string; label: ReactNode; required?: boolean; optionalText?: string }) {
  return (
    <label htmlFor={id} className="mb-1 block font-semibold">
      {label}
      {!required && optionalText ? <span className="font-normal text-muted"> ({optionalText})</span> : null}
    </label>
  );
}

export function TextField({ label, name, hint, error, optionalText, id, className, ...props }: Common & ComponentProps<"input">) {
  const fid = id ?? `f-${name}`;
  return (
    <div className={cn("mb-4", className)}>
      <Label id={fid} label={label} required={props.required} optionalText={optionalText} />
      <input
        id={fid}
        name={name}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...props}
      />
      <Describe id={fid} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ label, name, hint, error, optionalText, id, className, ...props }: Common & ComponentProps<"textarea">) {
  const fid = id ?? `f-${name}`;
  return (
    <div className={cn("mb-4", className)}>
      <Label id={fid} label={label} required={props.required} optionalText={optionalText} />
      <textarea
        id={fid}
        name={name}
        rows={4}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...props}
      />
      <Describe id={fid} hint={hint} error={error} />
    </div>
  );
}

export function Select({
  label,
  name,
  hint,
  error,
  optionalText,
  id,
  className,
  options,
  placeholder,
  ...props
}: Common & ComponentProps<"select"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const fid = id ?? `f-${name}`;
  return (
    <div className={cn("mb-4", className)}>
      <Label id={fid} label={label} required={props.required} optionalText={optionalText} />
      <select
        id={fid}
        name={name}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Describe id={fid} hint={hint} error={error} />
    </div>
  );
}

/** A group of checkboxes or radio buttons inside a fieldset with a legend. */
export function ChoiceGroup({
  legend,
  name,
  type = "checkbox",
  options,
  defaultValue,
  hint,
  error,
  required,
  className,
}: {
  legend: ReactNode;
  name: string;
  type?: "checkbox" | "radio";
  options: { value: string; label: ReactNode }[];
  defaultValue?: string | string[];
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const fid = `g-${name}`;
  const selected = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  return (
    <fieldset className={cn("mb-4", className)} aria-describedby={describedBy(fid, hint, error)}>
      <legend className="mb-1 font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 border-line-strong bg-white px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
          >
            <input
              type={type}
              name={name}
              value={o.value}
              defaultChecked={selected.includes(o.value)}
              required={required && type === "radio"}
              className="size-5 accent-[var(--color-brand)]"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <Describe id={fid} hint={hint} error={error} />
    </fieldset>
  );
}

export function Checkbox({ label, name, className, ...props }: { label: ReactNode; name: string } & ComponentProps<"input">) {
  return (
    <label className={cn("mb-4 flex min-h-11 cursor-pointer items-start gap-3", className)}>
      <input type="checkbox" name={name} className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Spam protection for public forms.
 *  - A hidden "honeypot" field: real people never see or fill it; spam bots often do.
 *  - Optional Cloudflare Turnstile check, shown only if NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function Honeypot() {
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {turnstileKey ? (
        <>
          <div className="cf-turnstile mb-4" data-sitekey={turnstileKey} data-size="flexible" />
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
        </>
      ) : null}
    </>
  );
}
