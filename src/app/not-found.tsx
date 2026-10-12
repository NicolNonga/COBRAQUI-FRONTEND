import Link from "next/link";
import { Compass } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";

export default function NotFound() {
  return (
    <StatusScreen code="404" icon={<Compass />} title="Página não encontrada"
      description="A página que procura não existe ou foi movida. Verifique o endereço ou volte ao painel principal."
      actions={<Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Voltar ao Dashboard</Link>} />
  );
}
