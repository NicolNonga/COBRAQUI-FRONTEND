"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Lock, Mail, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { errorMessage } from "@/lib/api/http";
import { RELOGIN_TIMEOUT_SECONDS } from "@/lib/api/session";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Modal de sessão expirada: NÃO se fecha (sem botão, sem Esc, sem clique fora).
 * O utilizador volta a entrar e continua onde estava; se demorar demasiado, vai para o login.
 */
export function SessionExpiredModal({ email: initialEmail, onLogin, onTimeout }: {
  email: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onTimeout: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(RELOGIN_TIMEOUT_SECONDS);
  const box = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    passRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // bloqueia Esc (e fecha-nada nos painéis por baixo) e mantém o foco dentro do modal
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("input, button, a[href]")].filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!box.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("keydown", key, true); document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left <= 0) timeoutRef.current(); }, [left]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Preencha o email e a palavra-passe.");
    setLoading(true);
    setError(null);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setPassword("");
      setLoading(false);
      passRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" aria-describedby="session-expired-desc"
        className="surface w-full max-w-md rounded-3xl border p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-50 text-warning-600 dark:bg-warning-500/15"><TimerReset className="h-5 w-5" /></span>
          <div>
            <h2 id="session-expired-title" className="text-lg font-semibold tracking-tight">A sua sessão expirou</h2>
            <p id="session-expired-desc" className="text-sm text-muted">Por segurança, volte a entrar para continuar. Não perde o que estava a fazer.</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-500/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="relogin-email">
            <Input id="relogin-email" type="email" autoComplete="email" leading={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </Field>
          <Field label="Palavra-passe" htmlFor="relogin-password">
            <Input id="relogin-password" ref={passRef} type="password" autoComplete="current-password" placeholder="••••••••" leading={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Continuar</Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted" aria-live="off">
          Se não voltar a entrar em <b className="tabular text-[var(--text)]">{mmss(Math.max(left, 0))}</b>, será levado para a página de login.
        </p>
      </div>
    </div>
  );
}
