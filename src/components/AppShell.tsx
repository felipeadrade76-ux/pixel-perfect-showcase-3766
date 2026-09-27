import { Link } from "@tanstack/react-router";
import { Home, ClipboardList, CalendarDays, Wallet, Plus, Wrench, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { loadOrdens, limparOrdens } from "@/lib/oficina-store";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", label: "Início", icon: Home },
  { to: "/ordens", label: "Ordens", icon: ClipboardList },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
] as const;

function irParaLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.href = "/login?next=" + encodeURIComponent(next);
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return irParaLogin();
      setPronto(true);
      loadOrdens();
    });
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_OUT") {
        limparOrdens();
        irParaLogin();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sair = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex items-center gap-2 px-2 py-4">
          <Wrench className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-bold leading-tight">
            Oficina
            <span className="block text-xs font-medium opacity-70">Inteligente</span>
          </span>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/nova"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-sidebar-primary px-3 py-3 text-sm font-bold text-sidebar-primary-foreground"
        >
          <Plus className="h-5 w-5" /> Nova entrada
        </Link>
        <button
          onClick={sair}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium opacity-80 hover:bg-sidebar-accent"
        >
          <LogOut className="h-5 w-5" /> Sair
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-primary px-4 py-4 text-primary-foreground md:bg-card md:text-foreground">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{title}</h1>
            {subtitle ? <p className="truncate text-sm opacity-80">{subtitle}</p> : null}
          </div>
          <button onClick={sair} aria-label="Sair" className="p-2 md:hidden">
            <LogOut className="h-5 w-5" />
          </button>
        </header>
        <main className="flex-1 p-4 pb-28 md:pb-8">{pronto ? children : null}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card md:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground data-[status=active]:text-accent"
          >
            <n.icon className="h-6 w-6" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
