import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";

export const metadata = { title: "Acesso negado" };

export default function AccessDenied() {
  return (
    <StatusScreen code="403" tone="warning" icon={<ShieldAlert />} title="Acesso negado"
      description="O seu perfil não tem permissão para aceder a este recurso. Se acha que é um erro, contacte o administrador do sistema."
      actions={<>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Ir para o Dashboard</Link>
        <Link href="/login" className="inline-flex h-10 items-center rounded-lg border surface px-4 text-sm font-medium hover:bg-soft">Trocar de conta</Link>
      </>} />
  );
}
