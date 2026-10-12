"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Pause, Play, PlugZap, RefreshCw, Save, Search } from "lucide-react";
import { Badge, Card, CardHeader, DescriptionList, EmptyState, PageHeader, Skeleton, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useAuth } from "@/components/shared/auth-provider";
import { ErrorBanner } from "@/components/shared/process-list";
import { useQuery } from "@/hooks/use-query";
import { integrationService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { P } from "@/lib/permissions";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Integration, IntegrationReview, IntegrationRun, IntegrationRunMode, IntegrationRunStatus, IntegrationStatus, IntegrationTestResult } from "@/types/models";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const dt = (iso: string | null | undefined) => (iso ? formatDate(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const STATUS: Record<IntegrationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Por configurar", tone: "neutral" },
  ACTIVE: { label: "Activa", tone: "success" },
  PAUSED: { label: "Pausada", tone: "warning" },
  ERROR: { label: "Com erro", tone: "danger" },
};
const RUN_STATUS: Record<IntegrationRunStatus, { label: string; tone: Tone }> = {
  RUNNING: { label: "A decorrer", tone: "info" },
  SUCCESS: { label: "Concluída", tone: "success" },
  PARTIAL: { label: "Com revisões", tone: "warning" },
  FAILED: { label: "Falhou", tone: "danger" },
};
const MODE: Record<IntegrationRunMode, string> = { DELTA: "Incremental", FULL: "Completa", DRY_RUN: "Simulação" };
const COUNTER: Record<string, string> = {
  invoicesRead: "Facturas lidas", creditorsCreated: "Credores criados", invoicesCreated: "Facturas criadas", invoicesLinked: "Facturas ligadas", invoicesPaid: "Pagas no ERP", invoicesPartial: "Pagamento parcial",
  invoicesCancelled: "Anuladas no ERP", amountsUpdated: "Valores actualizados", unchanged: "Sem alterações", debtorsCreated: "Devedores criados", debtorsLinked: "Devedores ligados",
  processesClosed: "Processos fechados", processesReadyToClose: "Prontos a fechar", reviewsOpened: "Revisões abertas", missingInErp: "Desaparecidas do ERP",
  linkCandidates: "Candidatas a ligação", skippedSettledUnknown: "Liquidadas ignoradas",
};
const REVIEW_KIND: Record<string, string> = {
  PROCESS_READY_TO_CLOSE: "Processo pronto a fechar", PAID_WITH_AGREEMENT: "Paga no ERP, com acordo activo", CANCELLED_WITH_AGREEMENT: "Anulada no ERP, com acordo activo",
  PARTIAL_WITH_AGREEMENT: "Pagamento parcial, com acordo activo", AMOUNT_CHANGED_WITH_AGREEMENT: "Valor alterado, com acordo activo", PAID_IN_DISPUTE: "Paga no ERP, em disputa",
  PAYMENT_REVERSED: "Pagamento revertido no ERP", MISSING_IN_ERP: "Desapareceu do ERP", AMBIGUOUS_MATCH: "Ligação ambígua", DEBTOR_INCOMPLETE: "Devedor incompleto",
  DEBTOR_CONFLICT: "Conflito de devedor", UNMAPPED_COMPANY: "Empresa desconhecida no ERP", INVALID_DATA: "Dados inválidos",
};

export default function IntegrationPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"link" | "runs" | "reviews">("link");
  const { data, error, reload } = useQuery(() => integrationService.get());

  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;

  const st = STATUS[data.status];
  return (
    <div className="space-y-6">
      <PageHeader title="Integração com o ERP" description="Ligação única ao SAP da empresa. O Cobraqui só lê: nunca escreve no ERP."
        actions={<Badge tone={st.tone} dot>{st.label}</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Última sincronização" value={data.lastRunAt ? timeAgo(data.lastRunAt) : "—"} tone="brand" footer={<span className="text-muted">{data.lastRun ? RUN_STATUS[data.lastRun.status].label : "nunca correu"}</span>} />
        <StatCard label="Próxima" value={data.status === "ACTIVE" ? dt(data.nextRunAt) : "—"} tone="info" footer={<span className="text-muted">a cada {data.intervalMinutes} min</span>} />
        <StatCard label="Revisões por tratar" value={data.openReviews} tone={data.openReviews ? "warning" : "success"} />
        <StatCard label="Falhas seguidas" value={data.consecutiveFailures} tone={data.consecutiveFailures ? "danger" : "success"} />
      </div>
      {data.status === "ERROR" && <ErrorBanner message="A integração parou depois de falhas seguidas. Veja a última execução, corrija a causa e volte a activar." />}
      <Tabs value={tab} onChange={setTab} items={[{ value: "link", label: "Ligação" }, { value: "runs", label: "Execuções" }, { value: "reviews", label: "Revisões", count: data.openReviews }]} />
      {tab === "link" && <ConnectionTab data={data} reload={reload} canManage={can(P.INTEGRATION_MANAGE)} />}
      {tab === "runs" && <RunsTab canManage={can(P.INTEGRATION_MANAGE)} active={data.status === "ACTIVE"} onChanged={reload} />}
      {tab === "reviews" && <ReviewsTab canResolve={can(P.INTEGRATION_REVIEW)} onChanged={reload} />}
    </div>
  );
}

/* ───────────────────────── Ligação ───────────────────────── */
function ConnectionTab({ data, reload, canManage }: { data: Integration; reload: () => void; canManage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [provider, setProvider] = useState(data.provider);
  const [cfg, setCfg] = useState<Record<string, unknown>>(data.config);
  const [sandboxText, setSandboxText] = useState(JSON.stringify((data.config.sandbox as object) ?? { customers: [], invoices: [] }, null, 2));
  const [opts, setOpts] = useState({ autoClose: data.autoClose, importDebtors: data.importDebtors, intervalMinutes: data.intervalMinutes });
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<IntegrationTestResult | null>(null);

  useEffect(() => {
    setProvider(data.provider); setCfg(data.config); setOpts({ autoClose: data.autoClose, importDebtors: data.importDebtors, intervalMinutes: data.intervalMinutes });
  }, [data]);

  const available = data.providers.filter((p) => p.available);
  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));
  const str = (k: string) => (typeof cfg[k] === "string" ? (cfg[k] as string) : "");
  const dirty = useMemo(() => provider !== data.provider || JSON.stringify(cfg) !== JSON.stringify(data.config) || opts.autoClose !== data.autoClose || opts.importDebtors !== data.importDebtors || opts.intervalMinutes !== data.intervalMinutes
  , [provider, cfg, opts, data]);

  async function wrap(key: string, title: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key);
    try { await fn(); if (okMsg) toast("success", okMsg); reload(); } catch (e) { toast("error", title, errorMessage(e)); } finally { setBusy(null); }
  }

  const save = () => wrap("save", "Não foi possível gravar", async () => {
    let config = cfg;
    if (provider === "SANDBOX") {
      try { config = { ...cfg, sandbox: JSON.parse(sandboxText) }; } catch { throw new Error("O JSON dos dados de teste é inválido."); }
    }
    await integrationService.update({ version: data.version, provider, config, ...opts });
  }, "Configuração gravada.");

  const saveCreds = () => wrap("creds", "Não foi possível gravar as credenciais", async () => {
    await integrationService.setCredentials({ username: user, password: pass });
    setUser(""); setPass("");
  }, "Credenciais gravadas (cifradas).");

  const test = async () => {
    setBusy("test"); setResult(null);
    try { setResult(await integrationService.test()); } catch (e) { toast("error", "A ligação falhou", errorMessage(e)); } finally { setBusy(null); }
  };

  const activate = async () => {
    const ok = await confirm({ title: "Activar a sincronização?", tone: "primary", confirmLabel: "Activar", description: "A primeira sincronização começa dentro de minutos e passa a repetir-se automaticamente. Recomenda-se uma simulação antes." });
    if (ok) wrap("act", "Não foi possível activar", () => integrationService.activate(), "Integração activada.");
  };

  const ro = !canManage;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader title="Sistema" description="Qual o ERP de onde vêm as facturas." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="ERP">
              <Select disabled={ro} value={provider} onChange={(e) => setProvider(e.target.value as Integration["provider"])}>
                {data.providers.map((p) => <option key={p.provider} value={p.provider} disabled={!p.available}>{p.label}{p.available ? "" : " (indisponível)"}</option>)}
              </Select>
            </Field>
            <Field label="Sincronizar a cada (minutos)" hint="Entre 5 e 1440.">
              <Input type="number" min={5} max={1440} disabled={ro} value={opts.intervalMinutes} onChange={(e) => setOpts({ ...opts, intervalMinutes: Number(e.target.value) })} />
            </Field>
          </div>
          {provider === "SAP_B1" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Endereço do Service Layer" required hint="Ex.: https://servidor:50000"><Input disabled={ro} value={str("baseUrl")} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://" /></Field>
              <Field label="Base de dados (CompanyDB)" required><Input disabled={ro} value={str("companyDb")} onChange={(e) => set("companyDb", e.target.value)} /></Field>
              <Field label="Código da empresa no Cobraqui" hint="Vazio = igual à base de dados."><Input disabled={ro} value={str("companyCode")} onChange={(e) => set("companyCode", e.target.value)} /></Field>
              <Field label="Moeda local" hint="Código de 3 letras."><Input disabled={ro} value={str("localCurrency") || "AOA"} onChange={(e) => set("localCurrency", e.target.value.toUpperCase())} maxLength={3} /></Field>
              <Field label="Número da factura" hint="O que o devedor vê no documento.">
                <Select disabled={ro} value={str("referenceField") || "DocNum"} onChange={(e) => set("referenceField", e.target.value)}>
                  <option value="DocNum">Número interno (DocNum)</option><option value="NumAtCard">Número do documento impresso (NumAtCard)</option>
                </Select>
              </Field>
              <div className="flex items-end"><Switch disabled={ro} checked={cfg.insecureTls === true} onChange={(v) => set("insecureTls", v)} label="Aceitar certificado autoassinado (só testes)" /></div>
            </div>
          )}
          {provider === "SAP_S4" && <div className="mt-4"><Field label="Endereço do SAP Gateway" required><Input disabled={ro} value={str("baseUrl")} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://" /></Field></div>}
          {provider === "SANDBOX" && (
            <div className="mt-4"><Field label="Dados de teste (JSON)" hint="{ customers: [...], invoices: [...] } — só fora de produção."><Textarea disabled={ro} rows={8} className="font-mono text-xs" value={sandboxText} onChange={(e) => setSandboxText(e.target.value)} /></Field></div>
          )}
        </Card>

        <Card>
          <CardHeader title="Credores" description="Vêm do ERP: na primeira sincronização cada empresa (ou filial) do SAP passa a ser um credor e as suas facturas ficam a ele associadas. Não é preciso associar nada à mão." />
          <div className="mt-4">
            {data.companies.length === 0 ? <p className="text-sm text-muted">Ainda não foram carregados. Faça uma simulação para ver quais seriam criados.</p> : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.companies.map((c) => (
                  <li key={c.companyCode} className="flex items-center justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate font-medium">{c.organizationName ?? c.companyCode}</span><Badge>empresa {c.companyCode}</Badge></li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Comportamento" />
          <div className="mt-4 space-y-4">
            <Switch disabled={ro} checked={opts.autoClose} onChange={(v) => setOpts({ ...opts, autoClose: v })} label="Fechar processos automaticamente quando tudo fica liquidado no ERP" />
            <p className="-mt-2 text-xs text-muted">Desligado: o processo vai para a fila de revisão e uma pessoa decide.</p>
            <Switch disabled={ro} checked={opts.importDebtors} onChange={(v) => setOpts({ ...opts, importDebtors: v })} label="Criar devedores a partir dos clientes do ERP" />
          </div>
          {canManage && <div className="mt-5 flex justify-end"><Button icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={busy === "save"} onClick={save}>Gravar configuração</Button></div>}
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        {canManage && (
          <Card>
            <CardHeader title="Credenciais" description={data.hasCredentials ? "Já estão gravadas (cifradas). Preencha só para substituir." : "Ainda não gravadas."} />
            <div className="mt-4 space-y-3">
              <Field label="Utilizador"><Input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" /></Field>
              <Field label="Palavra-passe"><Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></Field>
              <p className="text-xs text-muted">Use um utilizador só para o Cobraqui, com permissão de leitura em facturas de venda e parceiros de negócio.</p>
              <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} disabled={!user || !pass} loading={busy === "creds"} onClick={saveCreds}>Gravar credenciais</Button>
            </div>
          </Card>
        )}
        {canManage && (
          <Card>
            <CardHeader title="Testar e activar" />
            <div className="mt-4 space-y-3">
              {dirty && <p className="text-xs text-warning-600">Há alterações por gravar: o teste usa a configuração gravada.</p>}
              <Button variant="secondary" icon={<PlugZap className="h-4 w-4" />} loading={busy === "test"} onClick={test}>Testar a ligação</Button>
              {result && (
                <div className="rounded-lg border bg-subtle p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium text-success-600"><CheckCircle2 className="h-4 w-4" />Ligação estabelecida em {(result.durationMs / 1000).toFixed(1).replace(".", ",")} s</p>
                  <DescriptionList cols={1} items={[
                    { label: "Empresas no ERP", value: result.companyCodes.join(", ") || "—" },
                    { label: "Facturas em aberto", value: result.openInvoices ?? "n/d" },
                    ...(result.details ? [{ label: "Detalhes", value: result.details }] : []),
                  ]} />
                  {result.newCreditors.length > 0 && <p className="mt-2 flex items-start gap-2 text-muted"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Serão criados como credores: {result.newCreditors.join(", ")}.</p>}
                </div>
              )}
              {data.status === "ACTIVE"
                ? <Button variant="secondary" icon={<Pause className="h-4 w-4" />} loading={busy === "pause"} onClick={() => wrap("pause", "Não foi possível pausar", () => integrationService.pause(), "Integração pausada.")}>Pausar sincronização</Button>
                : <Button icon={<Play className="h-4 w-4" />} disabled={dirty} loading={busy === "act"} onClick={activate}>Activar sincronização</Button>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Execuções ───────────────────────── */
function RunsTab({ canManage, active, onChanged }: { canManage: boolean; active: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useQuery(() => integrationService.runs({ page, perPage: 10 }), [page]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const running = data?.data.some((r) => r.status === "RUNNING");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => { reload(); onChanged(); }, 4000);
    return () => clearInterval(t);
  }, [running, reload, onChanged]);

  async function launch(mode: IntegrationRunMode) {
    setBusy(true);
    try { const r = await integrationService.run(mode); toast("success", r.message); setPage(1); reload(); onChanged(); }
    catch (e) { toast("error", "Não foi possível iniciar", errorMessage(e)); } finally { setBusy(false); }
  }

  const columns: Column<IntegrationRun>[] = [
    { key: "when", header: "Início", cell: (r) => dt(r.startedAt) },
    { key: "mode", header: "Tipo", cell: (r) => <span>{MODE[r.mode]}<span className="text-muted"> · {r.trigger === "SCHEDULE" ? "agendada" : r.triggeredByName ?? "manual"}</span></span> },
    { key: "status", header: "Estado", cell: (r) => <Badge tone={RUN_STATUS[r.status].tone} dot>{RUN_STATUS[r.status].label}</Badge> },
    { key: "read", header: "Lidas", align: "right", cell: (r) => r.counters.invoicesRead ?? 0 },
    { key: "chg", header: "Alteradas", align: "right", hideOnMobile: true, cell: (r) => (r.counters.invoicesCreated ?? 0) + (r.counters.invoicesPaid ?? 0) + (r.counters.invoicesPartial ?? 0) + (r.counters.amountsUpdated ?? 0) + (r.counters.invoicesCancelled ?? 0) },
    { key: "rev", header: "Revisões", align: "right", cell: (r) => r.counters.reviewsOpened ?? 0 },
  ];
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Search className="h-4 w-4" />} loading={busy} onClick={() => launch("DRY_RUN")}>Simular (não grava nada)</Button>
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} disabled={busy || !active} onClick={() => launch("DELTA")}>Sincronizar agora</Button>
          <Button variant="ghost" disabled={busy || !active} onClick={() => launch("FULL")}>Carga completa</Button>
          {!active && <span className="self-center text-xs text-muted">Sincronizar exige a integração activa; a simulação não.</span>}
        </div>
      )}
      <DataTable columns={columns} rows={data?.data} loading={loading} meta={data?.meta} onPage={setPage} onRowClick={(r) => setOpen(r.id)} onRefresh={reload}
        empty={{ title: "Ainda não houve execuções", description: "Comece por uma simulação para ver o que a integração faria." }} />
      <RunDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function RunDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useQuery(() => (id ? integrationService.runDetail(id) : Promise.resolve(undefined)), [id]);
  return (
    <Drawer open={id !== null} onClose={onClose} title={data ? `${MODE[data.mode]} · ${dt(data.startedAt)}` : "Execução"} description={data ? RUN_STATUS[data.status].label : undefined} width="max-w-2xl">
      {!data ? <Skeleton className="h-48" /> : (
        <div className="space-y-5">
          {data.mode === "DRY_RUN" && <p className="rounded-lg border bg-subtle p-3 text-sm">Simulação: nada foi gravado. A lista abaixo é o que a integração faria.</p>}
          {data.error && <ErrorBanner message={data.error} />}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(data.counters).filter(([, v]) => v > 0).map(([k, v]) => (
              <div key={k} className="rounded-lg border p-3"><p className="tabular text-lg font-semibold">{v}</p><p className="text-xs text-muted">{COUNTER[k] ?? k}</p></div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Relatório ({data.report.length})</p>
            {data.report.length === 0 ? <p className="text-sm text-muted">Sem linhas.</p> : (
              <ul className="divide-y rounded-lg border text-sm">
                {data.report.slice(0, 300).map((l, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2"><Badge>{l.action}</Badge><span className="min-w-0 break-words">{l.message}</span></li>
                ))}
              </ul>
            )}
            {data.report.length > 300 && <p className="mt-2 text-xs text-muted">Mostradas as primeiras 300 linhas.</p>}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/* ───────────────────────── Revisões ───────────────────────── */
function ReviewsTab({ canResolve, onChanged }: { canResolve: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "IGNORED">("OPEN");
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useQuery(() => integrationService.reviews({ status, page, perPage: 10 }), [status, page]);
  const [sel, setSel] = useState<IntegrationReview | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "RESOLVE" | "IGNORE" | "CLOSE_PROCESS") {
    if (!sel) return;
    setBusy(true);
    try { const r = await integrationService.resolve(sel.id, action, note.trim() || undefined); toast("success", r.message); setSel(null); setNote(""); reload(); onChanged(); }
    catch (e) { toast("error", "Não foi possível tratar o caso", errorMessage(e)); } finally { setBusy(false); }
  }

  const columns: Column<IntegrationReview>[] = [
    { key: "kind", header: "Caso", cell: (r) => <div><p className="font-medium">{REVIEW_KIND[r.kind] ?? r.kind}</p><p className="max-w-xl text-xs text-muted">{r.summary}</p></div> },
    { key: "inv", header: "Factura / devedor", hideOnMobile: true, cell: (r) => <span>{r.invoiceReference ?? r.externalId}<span className="text-muted">{r.debtorName ? ` · ${r.debtorName}` : ""}</span></span> },
    { key: "date", header: "Aberto", hideOnMobile: true, cell: (r) => dt(r.createdAt) },
    { key: "st", header: "Estado", cell: (r) => <Badge tone={r.status === "OPEN" ? "warning" : "neutral"} dot>{r.status === "OPEN" ? "Por tratar" : r.status === "RESOLVED" ? "Tratado" : "Ignorado"}</Badge> },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["OPEN", "RESOLVED", "IGNORED"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "primary" : "secondary"} onClick={() => { setStatus(s); setPage(1); }}>{s === "OPEN" ? "Por tratar" : s === "RESOLVED" ? "Tratados" : "Ignorados"}</Button>
        ))}
      </div>
      <DataTable columns={columns} rows={data?.data} loading={loading} meta={data?.meta} onPage={setPage} onRefresh={reload} onRowClick={(r) => { setSel(r); setNote(""); }}
        empty={{ title: status === "OPEN" ? "Nada por tratar" : "Sem casos", description: status === "OPEN" ? "A integração decidiu tudo sozinha." : undefined, icon: <EmptyIcon /> }} />
      <Modal open={!!sel} onClose={() => setSel(null)} size="lg" title={sel ? REVIEW_KIND[sel.kind] ?? sel.kind : ""} description={sel?.summary}
        footer={sel?.status === "OPEN" && canResolve ? (
          <>
            <Button variant="ghost" disabled={busy} onClick={() => act("IGNORE")}>Ignorar</Button>
            {sel.kind === "PROCESS_READY_TO_CLOSE" && <Button variant="secondary" loading={busy} onClick={() => act("CLOSE_PROCESS")}>Fechar o processo</Button>}
            <Button loading={busy} onClick={() => act("RESOLVE")}>Marcar como tratado</Button>
          </>
        ) : undefined}>
        {sel && (
          <div className="space-y-4">
            <DescriptionList items={[
              { label: "Factura", value: sel.invoiceReference ?? sel.externalId }, { label: "Devedor", value: sel.debtorName ?? "—" },
              { label: "Aberto em", value: dt(sel.createdAt) }, { label: "Resolução", value: sel.resolution ? `${sel.resolution}${sel.resolvedByName ? ` (${sel.resolvedByName})` : ""}` : "—" },
            ]} />
            {sel.status === "OPEN" && canResolve && <Field label="Nota (opcional)"><Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que foi feito ou porque se ignora…" /></Field>}
          </div>
        )}
      </Modal>
    </div>
  );
}
const EmptyIcon = () => <CheckCircle2 className="h-6 w-6" />;
