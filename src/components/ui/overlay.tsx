"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, description, children, footer, size = "md", icon }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl"; icon?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="absolute inset-0 animate-fade-in bg-ink-950/45 backdrop-blur-[2px]" onClick={onClose} />
        <div role="dialog" aria-modal="true" className={cn("relative flex max-h-[92vh] w-full animate-slide-up flex-col rounded-t-2xl surface shadow-pop sm:rounded-2xl", w)}>
          <div className="flex items-start gap-3 px-6 pt-5 pb-4">
            {icon && <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button onClick={onClose} className="-mr-2 -mt-1 rounded-lg p-1.5 text-muted hover:bg-soft" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
          {children && <div className="scroll-thin overflow-y-auto px-6 pb-5">{children}</div>}
          {footer && <div className="flex flex-col-reverse gap-2 border-t bg-subtle px-6 py-3.5 sm:flex-row sm:justify-end rounded-b-2xl">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

export function Drawer({ open, onClose, title, description, children, footer, width = "max-w-xl" }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
        <aside className={cn("relative flex h-full w-full animate-slide-left flex-col surface shadow-pop", width)}>
          <header className="flex items-start gap-3 border-b px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
            </div>
            <button onClick={onClose} className="-mr-2 rounded-lg p-1.5 text-muted hover:bg-soft" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </header>
          <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t bg-subtle px-6 py-3.5">{footer}</footer>}
        </aside>
      </div>
    </Portal>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", tone = "danger", loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title} description={description}
      icon={<AlertTriangle className={cn("h-5 w-5", tone === "danger" && "text-danger-600")} />}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}
    />
  );
}

export function Dropdown({ trigger, children, align = "end", className }: { trigger: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: "start" | "end"; className?: string }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;
  const close = () => setPos(null);

  const toggle = () => {
    if (open) return close();
    const r = ref.current!.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 280;
    setPos({
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      ...(align === "end" ? { right: window.innerWidth - r.right } : { left: r.left }),
    });
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) close();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <span ref={ref} onClick={(e) => { e.stopPropagation(); toggle(); }} className="inline-flex">{trigger}</span>
      {open && (
        <Portal>
          <div ref={menuRef} style={pos ?? undefined} onClick={(e) => e.stopPropagation()}
            className={cn("fixed z-[60] min-w-[200px] animate-slide-up rounded-xl border surface p-1 shadow-pop", className)}>
            {typeof children === "function" ? children(close) : <div onClick={close}>{children}</div>}
          </div>
        </Portal>
      )}
    </>
  );
}

export function MenuItem({ icon, children, onClick, danger, disabled }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4",
        danger ? "text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10" : "hover:bg-soft [&_svg]:text-muted")}>
      {icon}{children}
    </button>
  );
}
export const MenuSeparator = () => <div className="my-1 h-px bg-[var(--border)]" />;
