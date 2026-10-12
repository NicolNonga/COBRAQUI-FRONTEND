"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCheck, PanelLeft, ChevronDown, CornerDownLeft, LogOut, Menu, Moon, Plus, Search, Settings, Sun, User as UserIcon, Zap, BellRing, Volume2, VolumeX,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar, Badge } from "@/components/ui/display";
import { Dropdown, MenuItem, MenuSeparator } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { displayName, useAuth } from "@/components/shared/auth-provider";
import { debtorService } from "@/lib/api/services";
import { useNotifications } from "@/components/shared/notifications-provider";
import type { Debtor } from "@/types/models";
import { flatNav, quickActions } from "./nav";

export function Topbar({ onMenu, onToggleSidebar }: { onMenu: () => void; onToggleSidebar: () => void }) {
  const { user, logout, can } = useAuth();
  const actions = quickActions.filter((a) => !a.perm || can(a.perm));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("cobraqui.theme", next ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-4 backdrop-blur-xl sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-muted hover:bg-soft lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
      <button onClick={onToggleSidebar} className="hidden rounded-lg p-2 text-muted hover:bg-soft hover:text-[var(--text)] lg:inline-flex" aria-label="Mostrar/ocultar menu" title="Mostrar/ocultar menu (Ctrl+B)"><PanelLeft className="h-5 w-5" /></button>

      <button onClick={() => setPaletteOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border surface px-3 text-sm text-muted shadow-card transition-colors hover:border-[color-mix(in_srgb,var(--muted)_45%,transparent)]">
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left">Pesquisar devedores, páginas, acções…</span>
        <kbd className="hidden rounded-md border bg-subtle px-1.5 py-0.5 font-mono text-[11px] sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">

        {actions.length > 0 && <Dropdown trigger={<Button size="sm" icon={<Plus className="h-4 w-4" />} className="hidden sm:inline-flex">Criar</Button>}>
          {actions.map((a) => (
            <Link key={a.label} href={a.href}><MenuItem icon={<a.icon />}>{a.label}</MenuItem></Link>
          ))}
        </Dropdown>}

        <button onClick={toggleTheme} className="rounded-lg p-2 text-muted hover:bg-soft hover:text-[var(--text)]" aria-label="Alternar tema">
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <NotificationBell />

        <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />

        {user && (
          <Dropdown trigger={
            <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-soft">
              <Avatar name={displayName(user)} size="sm" />
              <span className="hidden text-left md:block">
                <span className="block text-[13px] leading-4 font-medium">{displayName(user)}</span>
                <span className="block text-[11px] leading-4 text-muted">{user.role?.name ?? "—"}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
            </button>
          }>
            <div className="px-2.5 py-2">
              <p className="text-sm font-medium">{displayName(user)}</p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
            <MenuSeparator />
            <Link href="/profile"><MenuItem icon={<UserIcon />}>O meu perfil</MenuItem></Link>
            <Link href="/settings/organizations"><MenuItem icon={<Settings />}>Configurações</MenuItem></Link>
            <MenuSeparator />
            <MenuItem icon={<LogOut />} danger onClick={logout}>Terminar sessão</MenuItem>
          </Dropdown>
        )}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}

function NotificationBell() {
  const { items, unread, status, markRead, markAllRead, permission, enableDesktop, sound, setSound } = useNotifications();
  const tone = { high: "bg-danger-500", medium: "bg-warning-500", low: "bg-brand-500" };

  return (
    <Dropdown className="w-[380px] p-0" trigger={
      <button className="relative rounded-lg p-2 text-muted hover:bg-soft hover:text-[var(--text)]" aria-label="Notificações">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white ring-2 ring-[var(--bg)]">{unread}</span>}
      </button>
    }>
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              Notificações
              <span title={status === "connected" ? "Em tempo real" : "A ligar…"} className={cn("h-2 w-2 rounded-full", status === "connected" ? "bg-success-500" : "bg-warning-500 animate-pulse")} />
            </p>
            <button className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" onClick={() => markAllRead()}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          </div>
          {permission === "default" && (
            <div className="flex items-center gap-3 border-b bg-brand-50/60 px-4 py-2.5 dark:bg-brand-500/10">
              <BellRing className="h-4 w-4 shrink-0 text-brand-600" />
              <p className="flex-1 text-xs text-muted">Receba alertas mesmo com esta aba em segundo plano.</p>
              <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => enableDesktop()}>Activar</button>
            </div>
          )}
          <div className="scroll-thin max-h-[380px] overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Sem notificações.</p>}
            {items.slice(0, 6).map((n) => (
              <Link key={n.id} href={n.actionUrl ?? "/notifications"} onClick={() => { void markRead(n.id); close(); }}
                className={cn("flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-subtle", !n.isRead && "bg-brand-50/40 dark:bg-brand-500/5")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : tone[n.priority])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{n.title ?? "Notificação"}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2">
            <button className="flex items-center gap-1.5 text-xs text-muted hover:text-[var(--text)]" onClick={() => setSound(!sound)} title={sound ? "Desligar som" : "Ligar som"}>
              {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}{sound ? "Som ligado" : "Som desligado"}
            </button>
            <Link href="/notifications" onClick={close} className="text-[13px] font-medium text-brand-600 hover:underline">Ver todas</Link>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const router = useRouter();
  const { can } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  useEffect(() => {
    if (!open || q.length < 2) return setDebtors([]);
    const t = setTimeout(() => debtorService.search(q).then((r) => setDebtors(r.slice(0, 5))), 150);
    return () => clearTimeout(t);
  }, [q, open]);

  const results = useMemo(() => {
    const n = q.toLowerCase();
    const allowed = (x: { perm?: string }) => !x.perm || can(x.perm);
    const pages = flatNav.filter(allowed).filter((p) => !n || p.label.toLowerCase().includes(n)).map((p) => ({ ...p, kind: "Páginas" }));
    const actions = quickActions.filter(allowed).filter((a) => !n || a.label.toLowerCase().includes(n)).map((a) => ({ ...a, group: "Acções", kind: "Acções rápidas" }));
    const ds = debtors.map((d) => ({ label: d.name, href: `/debtors/${d.id}`, group: d.nif, kind: "Devedores", icon: undefined }));
    return [...ds, ...actions, ...pages];
  }, [q, debtors, can]);

  if (!open) return null;
  const go = (href: string) => { onClose(); router.push(href); };
  let lastKind = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl border surface shadow-pop">
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-5 w-5 text-muted" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="O que procura?"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && results[idx]) go(results[idx].href);
              if (e.key === "Escape") onClose();
            }}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]" />
          <kbd className="rounded-md border bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">ESC</kbd>
        </div>
        <div className="scroll-thin max-h-[400px] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">Nenhum resultado para “{q}”.</p>}
          {results.map((r, i) => {
            const header = r.kind !== lastKind ? r.kind : null;
            lastKind = r.kind;
            const Icon = r.icon ?? Zap;
            return (
              <div key={r.kind + r.href + r.label}>
                {header && <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{header}</p>}
                <button onMouseEnter={() => setIdx(i)} onClick={() => go(r.href)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", i === idx && "bg-soft")}>
                  {r.kind === "Devedores" ? <Avatar name={r.label} size="xs" /> : <Icon className="h-4 w-4 text-muted" />}
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="text-xs text-muted">{r.group}</span>
                  {i === idx && <CornerDownLeft className="h-3.5 w-3.5 text-muted" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
