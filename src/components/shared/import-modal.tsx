"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, History } from "lucide-react";
import { useAuth } from "@/components/shared/auth-provider";
import { P } from "@/lib/permissions";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { importService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { ImportResult } from "@/types/models";

/** Importação Excel com resultado detalhado (importados / falhados + relatório de erros do backend). */
export function ImportModal({ open, onClose, title, description, onImport, onDone, columnsHint }: {
  open: boolean; onClose: () => void; title: string; description: string;
  onImport: (file: File) => Promise<{ message: string; data: ImportResult }>; onDone?: () => void; columnsHint?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const toast = useToast();
  const { can } = useAuth();
  const close = () => { setFile(null); setResult(null); onClose(); };
  const report = typeof result?.errorReport === "string" ? result.errorReport : null;
  const failed = Number(result?.failed ?? 0);

  return (
    <Modal open={open} onClose={close} title={title} description={description} icon={<FileSpreadsheet className="h-5 w-5" />}
      footer={result ? <Button onClick={close}>Concluir</Button> : <>
        <Button variant="secondary" onClick={close}>Cancelar</Button>
        <Button disabled={!file} loading={loading} onClick={async () => {
          if (!file) return;
          setLoading(true);
          try {
            const r = await onImport(file);
            setResult(r.data);
            onDone?.();
            toast(Number(r.data.failed ?? 0) ? "info" : "success", r.message);
          } catch (e) {
            toast("error", "Falha na importação", errorMessage(e));
          } finally { setLoading(false); }
        }}>Importar</Button>
      </>}>
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-subtle p-3"><p className="tabular text-xl font-semibold">{result.total}</p><p className="text-xs text-muted">Linhas</p></div>
            <div className="rounded-xl bg-success-50 p-3 dark:bg-success-500/10"><p className="tabular text-xl font-semibold text-success-700">{result.imported}</p><p className="text-xs text-muted">Importadas</p></div>
            <div className="rounded-xl bg-danger-50 p-3 dark:bg-danger-500/10"><p className="tabular text-xl font-semibold text-danger-700">{failed}</p><p className="text-xs text-muted">Com erros</p></div>
          </div>
          {failed > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning-500/30 bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p>Algumas linhas não foram importadas. Descarregue o ficheiro com os erros assinalados, corrija e volte a importar.</p>
                {report && <Button variant="link" size="sm" className="mt-1" icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() => importService.downloadErrorReport(report).catch((e) => toast("error", errorMessage(e)))}>Descarregar relatório de erros</Button>}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" /> Todas as linhas foram importadas.</p>
          )}
          {result.batchId && can(P.IMPORT_HISTORY_VIEW) && (
            <Link href={`/imports?id=${result.batchId}`} onClick={close} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
              <History className="h-4 w-4" /> Ver esta importação no histórico{failed > 0 ? " (erros linha a linha)" : ""}
            </Link>
          )}
        </div>
      ) : (
        <>
          <FileDrop accept=".xlsx" file={file} onFile={setFile} hint="Ficheiro Excel (.xlsx) até 10 MB" />
          {columnsHint && <p className="mt-3 rounded-xl bg-subtle px-4 py-3 text-xs text-muted">{columnsHint}</p>}
        </>
      )}
    </Modal>
  );
}
