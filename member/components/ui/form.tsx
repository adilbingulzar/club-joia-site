"use client";

import { useId } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/member/lib/utils";
import type { ActionError } from "@/member/lib/errors";

/**
 * Form primitives. `tone="dark"` (member app) or `tone="light"` (admin portal).
 * Every input is labelled; errors are linked via aria-describedby.
 */
type Tone = "dark" | "light";

const inputBase = (tone: Tone) =>
  cn(
    "w-full rounded-xl border px-4 text-[15px] outline-none transition-colors placeholder:opacity-50 disabled:opacity-60",
    "focus:border-ruby focus:ring-2 focus:ring-ruby/25",
    tone === "dark" ? "border-line bg-surface text-pearl" : "border-black/12 bg-white text-ink",
  );

type FieldProps = {
  label: string;
  name: string;
  error?: string[] | string;
  hint?: string;
  tone?: Tone;
  className?: string;
  required?: boolean;
};

function FieldShell({
  label,
  id,
  error,
  hint,
  tone = "dark",
  className,
  required,
  children,
}: Omit<FieldProps, "name"> & { id: string; children: React.ReactNode }) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={cn("block text-[11px] font-medium uppercase tracking-[0.16em]", tone === "dark" ? "text-pearl-muted" : "text-black/60")}>
        {label}
        {required && <span aria-hidden className="text-ruby"> *</span>}
      </label>
      {children}
      {hint && !err && (
        <p id={`${id}-hint`} className={cn("text-xs", tone === "dark" ? "text-pearl-dim" : "text-black/50")}>
          {hint}
        </p>
      )}
      {err && (
        <p id={`${id}-error`} role="alert" className="text-xs text-ruby">
          {err}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  tone = "dark",
  className,
  required,
  ...props
}: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} tone={tone} className={className} required={required}>
      <input id={id} name={name} required={required} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={cn(inputBase(tone), "h-12")} {...props} />
    </FieldShell>
  );
}

export function TextArea({
  label,
  name,
  error,
  hint,
  tone = "dark",
  className,
  required,
  ...props
}: FieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} tone={tone} className={className} required={required}>
      <textarea id={id} name={name} required={required} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={cn(inputBase(tone), "min-h-28 py-3")} {...props} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  tone = "dark",
  className,
  required,
  options,
  placeholder,
  ...props
}: FieldProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} tone={tone} className={className} required={required}>
      <select id={id} name={name} required={required} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={cn(inputBase(tone), "h-12 appearance-none bg-no-repeat pr-10")} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  name,
  description,
  tone = "dark",
  ...props
}: { label: React.ReactNode; name: string; description?: string; tone?: Tone } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} className="mt-0.5 size-5 shrink-0 rounded border-line accent-[var(--color-ruby)]" style={{ colorScheme: tone }} {...props} />
      <label htmlFor={id} className="text-sm leading-snug">
        <span className={tone === "dark" ? "text-pearl" : "text-ink"}>{label}</span>
        {description && <span className={cn("mt-0.5 block text-xs", tone === "dark" ? "text-pearl-dim" : "text-black/50")}>{description}</span>}
      </label>
    </div>
  );
}

export function FormMessage({ error, success, tone = "dark" }: { error?: ActionError | null; success?: string | null; tone?: Tone }) {
  if (error) {
    return (
      <div role="alert" className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", tone === "dark" ? "border-ruby/40 bg-ruby/10 text-pearl" : "border-ruby/30 bg-ruby/5 text-ink")}>
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-ruby" aria-hidden />
        <div>
          <p>{error.message}</p>
          {error.reference && <p className="mt-1 text-xs opacity-70">Reference: {error.reference}</p>}
        </div>
      </div>
    );
  }
  if (success) {
    return (
      <div role="status" className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", tone === "dark" ? "border-success/40 bg-success/10 text-pearl" : "border-success/30 bg-success/5 text-ink")}>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <p>{success}</p>
      </div>
    );
  }
  return null;
}

export function Notice({ children, tone = "dark", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", tone === "dark" ? "border-line bg-surface text-pearl-muted" : "border-black/10 bg-black/[0.03] text-black/70")}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className={cn("font-medium", tone === "dark" ? "text-pearl" : "text-ink")}>{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
