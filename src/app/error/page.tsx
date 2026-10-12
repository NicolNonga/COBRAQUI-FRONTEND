import Link from "next/link";
import { ServerCrash } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";

export const metadata = { title: "Erro" };

export default function ErrorPage() {
  return (
    <StatusScreen code="500" tone="danger" icon={<ServerCrash />} title="Algo correu mal"
      description="Ocorreu um erro inesperado ao processar o seu pedido. A nossa equipa foi notificada. Tente novamente dentro de instantes."
      actions={<>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Voltar ao início</Link>
        <Link href="/login" className="inline-flex h-10 items-center rounded-lg border surface px-4 text-sm font-medium hover:bg-soft">Iniciar sessão</Link>
      </>} />
  );
}
