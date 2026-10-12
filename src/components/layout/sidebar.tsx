"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronsLeft, LifeBuoy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/shared/logo";
import { useAuth } from "@/components/shared/auth-provider";
import { visibleNavigation, type NavItem, type NavLeaf } from "./nav";

function useIsActive() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (href: string, exact = false) => {
    const [path, query] = href.split("?");
    if (query) {
      const [k, v] = query.split("=");
      return pathname === path && params.get(k) === v;
    }
    if (exact) return pathname === path && !params.get("status");
    return pathname === path || pathname.startsWith(path + "/");
  };
}

export function Sidebar({ collapsed, onCollapse, mobileOpen, onMobileClose }: {
  collapsed: boolean; onCollapse: () => void; mobileOpen: boolean; onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { can } = useAuth();
  const navigation = visibleNavigation(can);
  useEffect(() => onMobileClose(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const content = (mobile: boolean) => {
    const mini = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 shrink-0 items-center", mini ? "justify-center px-2" : "justify-between px-5")}>
          {mini ? (
            <button onClick={onCollapse} title="Expandir menu" aria-label="Expandir menu" className="rounded-lg"><LogoMark /></button>
          ) : <Link href="/dashboard"><Logo /></Link>}
          {mobile ? (
            <button onClick={onMobileClose} className="rounded-lg p-1.5 text-muted hover:bg-soft"><X className="h-5 w-5" /></button>
          ) : !mini ? (
            <button onClick={onCollapse} className="rounded-lg p-1.5 text-muted hover:bg-soft" title="Recolher menu"><ChevronsLeft className="h-4 w-4" /></button>
          ) : null}
        </div>

        <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto px-3 pt-2 pb-6">
          {navigation.map((section, i) => (
            <div key={i}>
              {section.title && !mini && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted/80 uppercase">{section.title}</p>}
              {section.title && mini && <div className="mx-auto mb-2 h-px w-6 bg-[var(--border)]" />}
              <ul className="space-y-0.5">
                {section.items.map((item) => <NavEntry key={item.href} item={item} mini={mini} onExpand={onCollapse} />)}
              </ul>
            </div>
          ))}
        </nav>

        {!mini && (
          <div className="m-3 rounded-xl border surface p-3.5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-medium"><LifeBuoy className="h-4 w-4 text-brand-600" /> Precisa de ajuda?</div>
            <p className="mt-1 text-xs text-muted">Consulte a documentação ou fale com o suporte.</p>
          </div>
        )}
        {mini && (
          <button onClick={onCollapse} className="mx-auto mb-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border surface text-muted shadow-card hover:text-[var(--text)]" title="Expandir menu" aria-label="Expandir menu">
            <ChevronsLeft className="h-4 w-4 rotate-180" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r bg-subtle transition-[width] duration-200 lg:block", collapsed ? "w-[72px]" : "w-[264px]")}>
        {content(false)}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/40" onClick={onMobileClose} />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-[slide-up_.2s_ease-out] border-r surface shadow-pop">{content(true)}</aside>
        </div>
      )}
    </>
  );
}

function NavEntry({ item, mini, onExpand }: { item: NavItem; mini: boolean; onExpand: () => void }) {
  const isActive = useIsActive();
  const groupActive = item.children ? item.children.some((c) => isActive(c.href)) || isActive(item.href) : isActive(item.href);
  const [open, setOpen] = useState(groupActive);
  useEffect(() => { if (groupActive) setOpen(true); }, [groupActive]);
  const Icon = item.icon;

  const base = "group flex w-full items-center gap-3 rounded-lg text-[14px] font-medium transition-colors";
  const iconEl = Icon && <Icon className={cn("h-[18px] w-[18px] shrink-0", groupActive ? "text-brand-600" : "text-muted group-hover:text-[var(--text)]")} strokeWidth={1.9} />;

  if (mini)
    return (
      <li>
        <Link href={item.children?.[0].href ?? item.href} title={item.label}
          className={cn(base, "h-10 justify-center", groupActive ? "surface shadow-card ring-1 ring-[var(--border)]" : "hover:bg-soft")}>
          {iconEl}
        </Link>
      </li>
    );

  if (!item.children)
    return (
      <li>
        <Link href={item.href} className={cn(base, "h-9 px-3", groupActive ? "surface text-[var(--text)] shadow-card ring-1 ring-[var(--border)]" : "text-muted hover:bg-soft hover:text-[var(--text)]")}>
          {iconEl}{item.label}
        </Link>
      </li>
    );

  return (
    <li>
      <button onClick={() => setOpen((o) => !o)} className={cn(base, "h-9 px-3", groupActive ? "text-[var(--text)]" : "text-muted hover:bg-soft hover:text-[var(--text)]")}>
        {iconEl}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="relative mt-0.5 ml-[21px] space-y-0.5 border-l pl-3">
          {item.children.map((c: NavLeaf) => {
            const active = isActive(c.href, c.href === item.children![0].href && c.href === item.href);
            return (
              <li key={c.href}>
                <Link href={c.href}
                  className={cn("relative flex h-8 items-center rounded-md px-2.5 text-[13.5px] transition-colors",
                    active ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-muted hover:bg-soft hover:text-[var(--text)]")}>
                  {active && <span className="absolute top-1.5 bottom-1.5 -left-[13px] w-0.5 rounded-full bg-brand-600" />}
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
