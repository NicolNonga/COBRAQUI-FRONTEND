"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./overlay";

export interface ConfirmOptions {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  /**
   * Acção a executar ao confirmar. O botão mostra "a carregar" enquanto corre e o diálogo
   * só fecha no fim. Se lançar erro, o diálogo fecha e o erro chega a quem chamou confirm().
   */
  onConfirm?: () => Promise<unknown> | unknown;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

/**
 * Confirmação reutilizável para acções sensíveis:
 *   const confirm = useConfirm();
 *   await confirm({ title: "Desactivar utilizador?", description: "…", onConfirm: () => api.disable(id) });
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<{ resolve: (v: boolean) => void; reject: (e: unknown) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve, reject) => {
    resolver.current = { resolve, reject };
    setOpts(o);
  }), []);

  const close = (v: boolean) => { resolver.current?.resolve(v); resolver.current = null; setOpts(null); setBusy(false); };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!opts}
        onClose={() => { if (!busy) close(false); }}
        loading={busy}
        title={opts?.title ?? ""}
        description={opts?.description ?? ""}
        confirmLabel={opts?.confirmLabel}
        tone={opts?.tone ?? "danger"}
        onConfirm={async () => {
          if (!opts?.onConfirm) return close(true);
          setBusy(true);
          try {
            await opts.onConfirm();
            close(true);
          } catch (e) {
            const r = resolver.current;
            resolver.current = null; setOpts(null); setBusy(false);
            r?.reject(e);
          }
        }}
      />
    </Ctx.Provider>
  );
}

/** Plano B (sem provider, p.ex. durante um hot-reload parcial): confirmação nativa do browser. */
const nativeConfirm: ConfirmFn = async (o) => {
  const text = typeof o.description === "string" ? `${o.title}\n\n${o.description}` : o.title;
  if (typeof window === "undefined" || !window.confirm(text)) return false;
  await o.onConfirm?.();
  return true;
};

export function useConfirm(): ConfirmFn {
  return useContext(Ctx) ?? nativeConfirm;
}
