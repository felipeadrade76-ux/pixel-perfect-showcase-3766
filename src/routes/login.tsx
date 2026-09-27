import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/safe-next";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Entrar — Oficina Inteligente" },
      { name: "description", content: "Acesse o sistema de gestão da sua oficina." },
      { property: "og:title", content: "Entrar — Oficina Inteligente" },
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
    <main className="flex min-h-screen items-center justify-center bg-primary p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-card-foreground shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <Wrench className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold">Oficina Inteligente</h1>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-lg border border-input bg-background px-3 text-base"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-12 rounded-lg border border-input bg-background px-3 text-base"
          />
          {msg && (
            <p role="alert" className="text-sm text-muted-foreground">
              {msg}
            </p>
          )}
          <button
            disabled={busy}
            className="h-12 rounded-lg bg-accent font-bold text-accent-foreground disabled:opacity-60"
          >
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <button
          onClick={google}
          className="mt-3 h-12 w-full rounded-lg border border-input bg-background font-medium"
        >
          Continuar com Google
        </button>
        <button
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="mt-4 w-full text-sm text-muted-foreground underline"
        >
          {modo === "entrar" ? "Não tem conta? Criar agora" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}
