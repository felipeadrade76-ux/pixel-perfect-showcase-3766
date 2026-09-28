import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RitmeiaBrand } from "@/components/RitmeiaBrand";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/safe-next";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Entrar — Ritmeia" },
      { name: "description", content: "Acesse sua operação na Ritmeia." },
      { property: "og:title", content: "Entrar — Ritmeia" },
      { property: "og:description", content: "Acesse o sistema de gestão da sua oficina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ir = () => {
    window.location.href = next;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && ir());
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && ir());
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg("E-mail ou senha incorretos.");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin + next },
      });
      setMsg(error ? error.message : "Enviamos um link para seu e-mail. Confirme para entrar.");
    }
    setBusy(false);
  }

  async function google() {
    sessionStorage.setItem("oficina-next", next);
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/login?next=" + encodeURIComponent(next),
      },
    });
    if (error) setMsg("Não foi possível entrar com Google.");
    setBusy(false);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div aria-hidden="true" className="absolute -left-20 top-16 h-64 w-64 rounded-full bg-accent/8 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-[28px] border border-border bg-card p-6 text-card-foreground shadow-[0_24px_70px_rgba(31,35,40,0.10)] sm:p-7">
        <div className="mb-7">
          <RitmeiaBrand />
          <h1 className="sr-only">Ritmeia</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Organização e automação para a rotina da sua oficina funcionar com mais clareza.
          </p>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-input bg-background px-3 text-base"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-12 rounded-xl border border-input bg-background px-3 text-base"
          />
          {msg && (
            <p role="alert" className="text-sm text-muted-foreground">
              {msg}
            </p>
          )}
          <button
            disabled={busy}
            className="h-12 rounded-xl bg-accent font-bold text-accent-foreground disabled:opacity-60"
          >
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <button
          onClick={google}
          className="mt-3 h-12 w-full rounded-xl border border-input bg-background font-medium"
        >
          Continuar com Google
        </button>
        <button
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary"
        >
          {modo === "entrar" ? "Não tem conta? Criar agora" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}
