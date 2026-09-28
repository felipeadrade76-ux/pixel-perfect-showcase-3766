import { Link } from "@tanstack/react-router";
import { Home, ClipboardList, CalendarDays, Wallet, Plus, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { loadOrdens, limparOrdens, selecionarUsuario } from "@/lib/oficina-store";
import { supabase } from "@/integrations/supabase/client";
import { RitmeiaBrand, RitmeiaSymbol } from "@/components/RitmeiaBrand";

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
  const [erroCarga, setErroCarga] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErroCarga("");
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          if (ativo) irParaLogin();
          return;
        }
        if (!ativo) return;
        selecionarUsuario(data.session.user.id);
        setPronto(true);
        await loadOrdens();
      } catch (error) {
        if (ativo)
          setErroCarga(error instanceof Error ? error.message : "Falha ao carregar ordens.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_OUT") {
        limparOrdens();
        irParaLogin();
      } else if (e === "SIGNED_IN" && session && selecionarUsuario(session.user.id)) {
        setPronto(false);
        setTentativa((n) => n + 1);
      }
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, [tentativa]);

  const sair = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen bg-background md:flex">
      <a
        href="#conteudo-principal"
        className="sr-only z-50 rounded-lg bg-accent px-4 py-3 font-bold text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-2xl px-3 py-3"
          aria-label="Ritmeia — ir para o início"
        >
          <RitmeiaBrand />
        </Link>
        <p className="mb-3 mt-10 px-4 text-[11px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/50">
          Área de trabalho
        </p>
        <nav aria-label="Menu principal" className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
            >
              <n.icon className="h-5 w-5 shrink-0" strokeWidth={1.9} />
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/nova"
          className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sidebar-primary px-3 py-3 text-sm font-extrabold text-sidebar-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary"
        >
          <Plus className="h-5 w-5" /> Nova ordem de serviço
        </Link>
        <div className="mt-auto border-t border-sidebar-border pt-5">
          <p className="px-4 text-xs text-sidebar-foreground/55">Seu espaço de trabalho</p>
          <button
            type="button"
            onClick={sair}
            className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-primary"
          >
            <LogOut className="h-5 w-5" /> Sair da conta
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-lg sm:px-6 md:px-8 md:py-5">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground md:hidden">
              <RitmeiaSymbol className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent md:hidden">
                Ritmeia
              </p>
              <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground sm:text-xl md:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <Link
              to="/nova"
              aria-label="Criar nova ordem de serviço"
              className="hidden min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:opacity-90 md:inline-flex"
            >
              <Plus className="h-4 w-4" /> Nova OS
            </Link>
            <button
              type="button"
              onClick={sair}
              aria-label="Sair da conta"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring md:hidden"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main
          id="conteudo-principal"
          className="min-w-0 flex-1 px-4 pb-32 pt-5 sm:px-6 md:px-8 md:pb-10 md:pt-8"
        >
          <div className="mx-auto w-full max-w-6xl">
            {erroCarga ? (
              <div
                role="alert"
                className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive"
              >
                <p>{erroCarga}</p>
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-xl border border-destructive/40 px-4 py-2 font-semibold"
                  onClick={() => setTentativa((n) => n + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : null}
            {carregando ? (
              <div role="status" className="space-y-3" aria-live="polite">
                <p className="text-sm text-muted-foreground">Carregando ordens...</p>
                <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
                <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
              </div>
            ) : null}
            {pronto && !erroCarga && !carregando ? children : null}
          </div>
        </main>
      </div>

      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-12px_32px_rgba(15,23,42,0.07)] backdrop-blur-xl md:hidden"
      >
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[11px] font-semibold text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring data-[status=active]:bg-secondary data-[status=active]:text-accent"
          >
            <n.icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
