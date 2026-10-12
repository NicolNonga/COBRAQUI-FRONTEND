"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; title: string; description?: string }

const Ctx = createContext<{ toast: (kind: ToastKind, title: string, description?: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = (id: number) => setItems((x) => x.filter((t) => t.id !== id));
  const toast = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { id, kind, title, description }]);
    setTimeout(() => dismiss(id), 4200);
  }, []);
  const icon = { success: <CheckCircle2 className="h-5 w-5 text-success-500" />, error: <AlertCircle className="h-5 w-5 text-danger-500" />, info: <Info className="h-5 w-5 text-brand-500" /> };
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed top-[76px] right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border surface p-3.5 shadow-pop")}>
            {icon[t.kind]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted hover:bg-soft"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast fora do ToastProvider");
  return c.toast;
}
