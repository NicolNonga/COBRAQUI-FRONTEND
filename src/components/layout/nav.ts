import {
  Banknote, BarChart3, Building2, FileUp, Coins, CreditCard, FileText, FolderKanban, FolderOpen, Handshake, History, Inbox, Landmark, LayoutDashboard,
  ListChecks, Phone, Scale, Shield, ShieldCheck, Tags, UserCog, Users, UsersRound, Wallet, Workflow, type LucideIcon, Plug } from "lucide-react";
import { P } from "@/lib/permissions";

export interface NavLeaf { label: string; href: string; icon?: LucideIcon; badge?: string; /** permissão necessária para ver a entrada */ perm?: string }
export interface NavItem extends NavLeaf { children?: NavLeaf[] }
export interface NavSection { title?: string; items: NavItem[] }

export const navigation: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, perm: P.DASHBOARD_VIEW }] },
  {
    title: "Cobrança",
    items: [
      {
        label: "Devedores", href: "/debtors", icon: Users, perm: P.DEBTOR_VIEW,
        children: [
          { label: "Devedores geral", href: "/debtors" },
          { label: "Minha carteira", href: "/wallet", perm: P.WALLET_VIEW },
        ],
      },
      {
        label: "Facturas", href: "/invoices", icon: FileText, perm: P.INVOICE_VIEW,
        children: [
          { label: "Listagem geral", href: "/invoices" },
          { label: "Pendentes", href: "/invoices?status=PENDING" },
          { label: "Vencidas", href: "/invoices?status=OVERDUE" },
          { label: "Pagas", href: "/invoices?status=PAID" },
        ],
      },
      {
        label: "Processos", href: "/processes", icon: FolderKanban, perm: P.PROCESS_VIEW,
        children: [
          { label: "Listagem geral", href: "/processes" },
          { label: "Meus processos", href: "/processes/mine" },
        ],
      },
      {
        label: "Negociações", href: "/negotiations", icon: Handshake, perm: P.NEGOTIATION_VIEW,
        children: [
          { label: "Listagem geral", href: "/negotiations" },
          { label: "Nova negociação", href: "/negotiations/new", perm: P.NEGOTIATION_CREATE },
        ],
      },
      { label: "Pagamentos", href: "/payments", icon: Banknote, perm: P.PAYMENT_VIEW },
      { label: "Disputas", href: "/disputes", icon: Scale, perm: P.DISPUTE_VIEW },
      {
        label: "Régua de cobrança", href: "/ladders", icon: Workflow, perm: P.LADDER_VIEW,
        children: [
          { label: "Réguas", href: "/ladders" },
          { label: "Tarefas e cumprimento", href: "/ladders/tasks" },
          { label: "Régua master", href: "/ladders/policy" },
        ],
      },
    ],
  },
  {
    title: "Análise",
    items: [
      {
        label: "Estatísticas", href: "/statistics", icon: BarChart3, perm: P.REPORTS_VIEW,
        children: [
          { label: "Indicadores", href: "/statistics" },
          { label: "Aging list", href: "/statistics?tab=aging" },
          { label: "Fluxo de caixa", href: "/statistics?tab=cash-flow" },
          { label: "Contactos", href: "/statistics?tab=contacts" },
          { label: "Acordos quebrados", href: "/statistics?tab=broken" },
          { label: "Disputas", href: "/statistics?tab=disputes" },
          { label: "Custos", href: "/statistics?tab=costs" },
        ],
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Conta-corrente credores", href: "/creditors", icon: Landmark, perm: P.CREDITOR_ACCOUNT_VIEW },
      { label: "Documentos", href: "/documents", icon: FolderOpen },
      { label: "Meus agentes", href: "/agents", icon: UsersRound, perm: P.DASHBOARD_VIEW },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Auditoria", href: "/audit", icon: History, perm: P.AUDIT_VIEW },
      { label: "Importações", href: "/imports", icon: FileUp, perm: P.IMPORT_HISTORY_VIEW },
      { label: "Fila de envios", href: "/outbox", icon: Inbox, perm: P.OUTBOX_MANAGE },
      { label: "Integração ERP", href: "/integration", icon: Plug, perm: P.INTEGRATION_VIEW },
      {
        label: "Controlo de acesso", href: "/access-control", icon: Shield,
        children: [
          { label: "Utilizadores", href: "/access-control/users", icon: UserCog, perm: P.USER_VIEW },
          { label: "Perfis", href: "/access-control/roles", icon: ShieldCheck, perm: P.ROLE_VIEW },
          { label: "Permissões", href: "/access-control/permissions", icon: ListChecks, perm: P.ROLE_VIEW },
        ],
      },
      {
        label: "Configurações", href: "/settings", icon: Tags,
        children: [
          { label: "Credores", href: "/settings/organizations", icon: Building2, perm: P.ORGANIZATION_VIEW },
          { label: "Meios de pagamento", href: "/settings/payment-methods", icon: CreditCard },
          { label: "Moedas", href: "/settings/currencies", icon: Coins },
          { label: "Tipos de devedor", href: "/settings/client-types", icon: Tags },
          { label: "Tipos de contacto", href: "/settings/contact-types", icon: Phone },
          { label: "Categorias", href: "/settings/categories", icon: Wallet },
        ],
      },
    ],
  },
];

/** Lista plana para a paleta de comandos (⌘K). */
export const flatNav: { label: string; href: string; group: string; icon?: LucideIcon; perm?: string }[] = navigation.flatMap((s) =>
  s.items.flatMap((i) =>
    i.children
      ? i.children.map((c) => ({ label: c.label === "Listagem geral" || c.label === "Devedores geral" || c.label === "Réguas" || c.label === "Indicadores" ? i.label : `${i.label} · ${c.label}`, href: c.href, group: s.title ?? "Geral", icon: c.icon ?? i.icon, perm: c.perm ?? i.perm }))
      : [{ label: i.label, href: i.href, group: s.title ?? "Geral", icon: i.icon, perm: i.perm }],
  ),
);

export const quickActions: { label: string; href: string; icon: LucideIcon; perm?: string }[] = [
  { label: "Novo devedor", href: "/debtors?new=1", icon: Users, perm: P.DEBTOR_CREATE },
  { label: "Nova factura", href: "/invoices?new=1", icon: FileText, perm: P.INVOICE_CREATE },
  { label: "Nova negociação", href: "/negotiations/new", icon: Handshake, perm: P.NEGOTIATION_CREATE },
  { label: "Registar pagamento", href: "/payments", icon: Banknote, perm: P.PAYMENT_REGISTER },
  { label: "Carregar documento", href: "/documents?upload=1", icon: FolderOpen },
  { label: "Novo utilizador", href: "/access-control/users?new=1", icon: UserCog, perm: P.USER_CREATE },
];

/** Filtra o menu pelas permissões do utilizador; grupos sem filhos visíveis desaparecem. */
export function visibleNavigation(can: (p: string) => boolean): NavSection[] {
  const ok = (l: NavLeaf) => !l.perm || can(l.perm);
  return navigation
    .map((s) => ({
      ...s,
      items: s.items
        .filter(ok)
        .map((i) => (i.children ? { ...i, children: i.children.filter(ok) } : i))
        .filter((i) => !i.children || i.children.length > 0),
    }))
    .filter((s) => s.items.length > 0);
}
