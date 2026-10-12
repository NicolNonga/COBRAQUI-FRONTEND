"use client";
import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { authService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { cn } from "@/lib/utils";

// Regras do backend: 8–128 caracteres, com letras e números.
const rules = [
  { label: "Mínimo de 8 caracteres", test: (s: string) => s.length >= 8 },
  { label: "Pelo menos uma letra", test: (s: string) => /[A-Za-z]/.test(s) },
  { label: "Pelo menos um número", test: (s: string) => /\d/.test(s) },
  { label: "Recomendado: um símbolo", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
];
const REQUIRED = 3;

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const passed = rules.filter((r) => r.test(pw)).length;
  const mismatch = touched && confirm.length > 0 && pw !== confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (rules.slice(0, REQUIRED).some((r) => !r.test(pw)) || pw !== confirm) return;
    setLoading(true);
    try {
      await authService.resetPassword(token, pw);
      toast("success", "Palavra-passe reposta", "Já pode iniciar sessão com a nova palavra-passe.");
      router.replace("/login");
    } catch (err) {
      toast("error", "Não foi possível repor", errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border surface shadow-card"><ShieldCheck className="h-5 w-5 text-brand-600" /></div>
      <h1 className="text-[28px] font-semibold tracking-tight">Definir nova palavra-passe</h1>
      <p className="mt-2 text-sm text-muted">Escolha uma palavra-passe forte que não utilize noutros serviços.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Nova palavra-passe">
          <Input type="password" leading={<Lock />} value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" placeholder="••••••••" />
        </Field>
        <div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < passed ? (passed <= 2 ? "bg-warning-500" : passed === 3 ? "bg-brand-500" : "bg-success-500") : "bg-soft")} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {rules.map((r) => (
              <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.test(pw) ? "text-success-600" : "text-muted")}>
                <Check className="h-3.5 w-3.5" /> {r.label}
              </li>
            ))}
          </ul>
        </div>
        <Field label="Confirmar palavra-passe" error={mismatch ? "As palavras-passe não coincidem." : null}>
          <Input type="password" leading={<Lock />} value={confirm} invalid={mismatch} onChange={(e) => setConfirm(e.target.value)} onBlur={() => setTouched(true)} className="h-11" placeholder="••••••••" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={rules.slice(0, REQUIRED).some((r) => !r.test(pw)) || !confirm}>Repor palavra-passe</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">Lembrou-se? <Link href="/login" className="font-medium text-brand-600">Iniciar sessão</Link></p>
    </>
  );
}
