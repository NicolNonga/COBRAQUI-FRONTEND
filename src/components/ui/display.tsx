"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn("rounded-2xl border surface shadow-card", padded && "p-5", className)}>{children}</div>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumbs && (
          <nav className="mb-2 flex items-center gap-1.5 text-[13px] text-muted">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="opacity-50">/</span>}
                {b.href ? <Link href={b.href} className="hover:text-[var(--text)]">{b.label}</Link> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-soft text-[var(--muted)] ring-[var(--border)]",
  brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30",
  success: "bg-success-50 text-success-700 ring-success-500/25 dark:bg-success-500/15 dark:text-success-500",
  warning: "bg-warning-50 text-warning-700 ring-warning-500/25 dark:bg-warning-500/15 dark:text-warning-500",
  danger: "bg-danger-50 text-danger-700 ring-danger-500/25 dark:bg-danger-500/15 dark:text-danger-500",
  info: "bg-sky-50 text-sky-700 ring-sky-500/25 dark:bg-sky-500/15 dark:text-sky-400",
};
const dots: Record<Tone, string> = {
  neutral: "bg-[var(--muted)]", brand: "bg-brand-500", success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500", info: "bg-sky-500",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

const avatarColors = ["bg-brand-100 text-brand-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700"];
export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { xs: "h-6 w-6 text-[10px]", sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm", xl: "h-16 w-16 text-lg" }[size];
  const color = avatarColors[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", s, color, className)}>{initials(name)}</span>;
}

export function StatCard({ label, value, delta, deltaLabel, icon, tone = "brand", footer, href }: {
  label: string; value: ReactNode; delta?: number; deltaLabel?: string; icon?: ReactNode; tone?: Tone; footer?: ReactNode; href?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const inner = (
    <Card className={cn("h-full transition-shadow", href && "hover:shadow-pop")}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset [&_svg]:h-4 [&_svg]:w-4", tones[tone])}>{icon}</span>}
      </div>
      <p className="tabular mt-2 text-[26px] leading-8 font-semibold tracking-tight">{value}</p>
      {(delta !== undefined || footer) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success-600" : "text-danger-600")}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(1).replace(".", ",")}%
            </span>
          )}
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
          {footer}
        </div>
      )}
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border surface text-muted shadow-card [&_svg]:h-5 [&_svg]:w-5">{icon ?? <Inbox />}</div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton rounded-md", className)} />;

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="scroll-thin -mb-px flex gap-6 overflow-x-auto border-b">
      {items.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn("relative flex shrink-0 items-center gap-2 pb-3 text-sm font-medium transition-colors",
            value === t.value ? "text-brand-600" : "text-muted hover:text-[var(--text)]")}>
          {t.label}
          {t.count !== undefined && (
            <span className={cn("tabular rounded-full px-1.5 py-px text-[11px]", value === t.value ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "bg-soft text-muted")}>{t.count}</span>
          )}
          {value === t.value && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

export function DescriptionList({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{i.label}</dt>
          <dd className="mt-1 truncate text-sm">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Progress({ value, tone = "brand", className }: { value: number; tone?: "brand" | "success" | "warning" | "danger"; className?: string }) {
  const c = { brand: "bg-brand-500", success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-soft", className)}>
      <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export type { Tone };
