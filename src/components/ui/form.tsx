"use client";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, ChevronDown, Eye, EyeOff, Search, UploadCloud, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full surface border rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--muted)]/70 transition-[border,box-shadow] outline-none hover:border-[color-mix(in_srgb,var(--muted)_45%,transparent)] focus:border-brand-500 focus:shadow-focus disabled:bg-soft disabled:cursor-not-allowed aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus:shadow-[0_0_0_4px_rgb(240_68_56/0.14)]";

export function Field({ label, hint, error, required, children, className, htmlFor }: {
  label?: ReactNode; hint?: ReactNode; error?: string | null; required?: boolean; children: ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--text)]">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger-600">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ leading, trailing, invalid, className, type, ...props }, ref) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="relative flex items-center">
      {leading && <span className="pointer-events-none absolute left-3 flex text-muted [&_svg]:h-4 [&_svg]:w-4">{leading}</span>}
      <input
        ref={ref}
        type={isPassword && show ? "text" : type}
        aria-invalid={invalid || undefined}
        className={cn(fieldBase, "h-9 px-3", leading && "pl-9", (trailing || isPassword) && "pr-10", className)}
        {...props}
      />
      {isPassword ? (
        <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute right-2.5 text-muted hover:text-[var(--text)]" aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      ) : trailing ? (
        <span className="absolute right-3 flex text-sm text-muted">{trailing}</span>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "min-h-[88px] px-3 py-2", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string }>(
  function Select({ className, invalid, placeholder, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-9 appearance-none pl-3 pr-9", className)} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    );
  },
);

export function SearchInput({ value, onChange, placeholder = "Pesquisar…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(fieldBase, "h-9 pl-9 pr-8")} />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-soft" aria-label="Limpar">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:shadow-focus disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-[color-mix(in_srgb,var(--muted)_35%,transparent)]")}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, indeterminate, label, className, disabled }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean; label?: ReactNode; className?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("inline-flex items-center gap-2 text-sm select-none", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer", className)} onClick={(e) => e.stopPropagation()}>
      <button
        id={id} type="button" role="checkbox" aria-checked={indeterminate ? "mixed" : checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors outline-none focus-visible:shadow-focus disabled:cursor-not-allowed",
          checked || indeterminate ? "border-brand-600 bg-brand-600 text-white" : "surface border-[color-mix(in_srgb,var(--muted)_50%,transparent)]")}
      >
        {indeterminate ? <span className="h-0.5 w-2 rounded bg-white" /> : checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>
      {label}
    </label>
  );
}

export function SegmentedControl<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-soft p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium transition-all",
            value === o.value ? "surface text-[var(--text)] shadow-card" : "text-muted hover:text-[var(--text)]")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FileDrop({ accept, file, onFile, hint }: { accept?: string; file: File | null; onFile: (f: File | null) => void; hint?: string }) {
  const [over, setOver] = useState(false);
  const id = useId();
  if (file)
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-subtle p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15"><FileText className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB</p>
        </div>
        <button type="button" onClick={() => onFile(null)} className="rounded-md p-1.5 text-muted hover:bg-soft"><X className="h-4 w-4" /></button>
      </div>
    );
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        over ? "border-brand-500 bg-brand-50/60 dark:bg-brand-500/10" : "hover:border-brand-300 hover:bg-subtle")}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-soft text-muted"><UploadCloud className="h-5 w-5" /></div>
      <p className="text-sm"><span className="font-semibold text-brand-600">Clique para carregar</span> ou arraste o ficheiro</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <input id={id} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
