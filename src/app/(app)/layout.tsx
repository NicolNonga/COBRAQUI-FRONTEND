"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/shared/auth-provider";
import { LogoMark } from "@/components/shared/logo";
import { NotificationsProvider } from "@/components/shared/notifications-provider";
import { cn } from "@/lib/utils";

function Shell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("cobraqui.sidebar") === "collapsed");
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleSidebar(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSidebar = () =>
    setCollapsed((c) => { localStorage.setItem("cobraqui.sidebar", c ? "open" : "collapsed"); return !c; });
  useEffect(() => {
    if (ready && !user) {
      document.cookie = "cobraqui_session=; path=/; max-age=0";
      router.replace("/login");
    }
  }, [ready, user, router]);

  if (!ready || !user)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoMark className="h-10 w-10 animate-pulse" />
      </div>
    );

  return (
    <NotificationsProvider>
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onCollapse={toggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]")}>
        <Topbar onMenu={() => setMobileOpen(true)} onToggleSidebar={toggleSidebar} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
    </NotificationsProvider>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
