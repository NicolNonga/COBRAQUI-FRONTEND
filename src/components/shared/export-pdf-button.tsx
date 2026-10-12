"use client";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { downloadProtected, errorMessage } from "@/lib/api/http";

/**
 * Exporta a tabela em PDF: o servidor gera o documento com os MESMOS filtros do ecrã
 * (todas as páginas, não só a visível) e respeitando as permissões de quem pede.
 */
export function ExportPdfButton({ path, params, name, label = "Exportar PDF", disabled }: {
  /** rota da API, ex.: "invoices/export/pdf" */
  path: string;
  /** filtros activos (page/perPage são ignorados) */
  params: Record<string, string | number | boolean | undefined | null>;
  /** nome do ficheiro, sem extensão */
  name: string;
  label?: string;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || k === "perPage" || v === undefined || v === null || v === "") continue;
      q.set(k, String(v));
    }
    setBusy(true);
    try {
      await downloadProtected(`${path}${q.toString() ? `?${q}` : ""}`, `${name}.pdf`);
      toast("success", "PDF gerado", "A tabela completa, com os filtros aplicados, foi descarregada.");
    } catch (e) {
      toast("error", "Não foi possível exportar o PDF", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={busy} disabled={disabled} onClick={run}>{label}</Button>;
}
