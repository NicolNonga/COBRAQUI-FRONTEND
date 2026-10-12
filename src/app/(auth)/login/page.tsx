"use client";
import { errorMessage } from "@/lib/api/http";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { useAuth } from "@/components/shared/auth-provider";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return setError("Preencha o email e a palavra-passe.");
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.replace(params.get("next") || "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 text-sm text-muted">Inicie sessão para gerir a sua carteira de cobranças.</p>

      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-500/10">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" placeholder="nome@empresa.ao" leading={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <Field
          label={<span className="flex w-full items-center justify-between">Palavra-passe <Link href="/forgot-password" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">Esqueceu a palavra-passe?</Link></span>}
          htmlFor="password"
        >
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" leading={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </Field>
        <Checkbox checked={remember} onChange={setRemember} label={<span className="text-muted">Lembrar este dispositivo</span>} />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Entrar {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
