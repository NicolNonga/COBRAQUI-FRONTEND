"use client";
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-danger" | "link";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(16_24_40/0.08)] hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  secondary:
    "surface border text-[var(--text)] shadow-card hover:bg-soft active:bg-soft disabled:opacity-60",
  ghost: "text-muted hover:bg-soft hover:text-[var(--text)] disabled:opacity-50",
  danger: "bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-60 shadow-card",
  "outline-danger": "surface border border-danger-500/30 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10",
  link: "text-brand-600 hover:text-brand-700 hover:underline underline-offset-4 px-0 h-auto",
};
const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  /** se devolver uma Promise, o botão mostra "a carregar" e fica bloqueado até terminar (evita duplo clique) */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", onClick, ...props },
  ref,
) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const busy = loading ?? pending;

  const handleClick = onClick && ((e: MouseEvent<HTMLButtonElement>) => {
    if (busy) return;
    const r = onClick(e);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setPending(true);
      (r as Promise<unknown>).finally(() => { if (mounted.current) setPending(false); }).catch((err) => console.error(err));
    }
  });

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 outline-none focus-visible:shadow-focus disabled:cursor-not-allowed select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});
