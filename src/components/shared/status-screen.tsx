import type { ReactNode } from "react";
import { DotGrid } from "./dot-grid";
import { Logo } from "./logo";

export function StatusScreen({ code, title, description, icon, actions, tone = "brand" }: {
  code: string; title: string; description: string; icon: ReactNode; actions: ReactNode; tone?: "brand" | "danger" | "warning";
}) {
  const ring = { brand: "text-brand-600 bg-brand-50 dark:bg-brand-500/15", danger: "text-danger-600 bg-danger-50 dark:bg-danger-500/15", warning: "text-warning-600 bg-warning-50 dark:bg-warning-500/15" }[tone];
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <DotGrid />
      <div className="absolute top-8 left-8"><Logo /></div>
      <div className="relative max-w-md text-center">
        <div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6 ${ring}`}>{icon}</div>
        <p className="font-mono text-sm font-medium text-muted">{code}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
      </div>
    </div>
  );
}
