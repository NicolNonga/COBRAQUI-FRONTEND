"use client";
import { errorMessage } from "@/lib/api/http";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { authService } from "@/lib/api/services";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Introduza um email válido.");
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      router.push(`/forgot-password/sent?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border surface shadow-card"><KeyRound className="h-5 w-5 text-brand-600" /></div>
      <h1 className="text-[28px] font-semibold tracking-tight">Esqueceu a palavra-passe?</h1>
      <p className="mt-2 text-sm text-muted">Sem problema. Indique o email da sua conta e enviaremos um link para repor a palavra-passe.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Email" error={error}>
          <Input type="email" placeholder="nome@empresa.ao" leading={<Mail />} value={email} invalid={!!error} onChange={(e) => { setEmail(e.target.value); setError(null); }} className="h-11" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Enviar instruções</Button>
      </form>
      <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-[var(--text)]">
        <ArrowLeft className="h-4 w-4" /> Voltar ao início de sessão
      </Link>
    </>
  );
}
