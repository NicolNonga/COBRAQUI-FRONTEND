"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { authService } from "@/lib/api/services";

function Sent() {
  const email = useSearchParams().get("email") ?? "o seu email";
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15"><MailCheck className="h-6 w-6" /></div>
      <h1 className="text-[28px] font-semibold tracking-tight">Verifique o seu email</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enviámos as instruções de recuperação para <span className="font-medium text-[var(--text)]">{email}</span>. O link expira em 30 minutos.
      </p>
      <div className="mt-8 space-y-3">
        <Button size="lg" className="w-full" onClick={() => window.open("mailto:", "_blank")}>Abrir aplicação de email</Button>
        <p className="text-center text-sm text-muted">
          Não recebeu?{" "}
          <button disabled={loading} className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            onClick={async () => { setLoading(true); await authService.forgotPassword(email); setLoading(false); toast("success", "Email reenviado", "Verifique também a pasta de spam."); }}>
            {loading ? "A reenviar…" : "Reenviar email"}
          </button>
        </p>
      </div>
      <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-[var(--text)]">
        <ArrowLeft className="h-4 w-4" /> Voltar ao início de sessão
      </Link>
    </>
  );
}

export default function Page() {
  return <Suspense><Sent /></Suspense>;
}
