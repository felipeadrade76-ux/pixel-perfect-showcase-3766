import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Details = {
  client?: { name?: string } | null;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};
type Res = { data: Details | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Res>;
  approveAuthorization: (id: string) => Promise<Res>;
  denyAuthorization: (id: string) => Promise<Res>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido.");
    const { data } = await supabase.auth.getSession();
    if (!data.session)
      throw redirect({ to: "/login", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  head: () => ({
    meta: [
      { title: "Autorizar acesso — Oficina Inteligente" },
      { name: "description", content: "Autorize um assistente a acessar sua oficina." },
      { property: "og:title", content: "Autorizar acesso — Oficina Inteligente" },
      { property: "og:description", content: "Autorize um assistente a acessar sua oficina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="p-6">Não foi possível carregar este pedido: {String(error?.message ?? error)}</main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nome = details?.client?.name ?? "Um aplicativo";

  async function decide(ok: boolean) {
    setBusy(true);
    const { data, error } = ok
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const t = data?.redirect_url ?? data?.redirect_to;
    if (!t) {
      setBusy(false);
      return setError("Nenhum endereço de retorno recebido.");
    }
    window.location.href = t;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-card-foreground shadow-lg">
        <h1 className="text-xl font-bold">Conectar {nome} à Oficina Inteligente</h1>
        <p className="mt-2 text-sm text-muted-foreground">Conta: {email}</p>
        <p className="mt-4">
          {nome} poderá consultar e atualizar suas ordens de serviço em seu nome.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu e-mail e perfil básico serão compartilhados. Isso não ignora as permissões do app.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="mt-6 h-12 w-full rounded-lg bg-accent font-bold text-accent-foreground"
        >
          Autorizar
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="mt-2 h-12 w-full rounded-lg border border-input font-medium"
        >
          Cancelar conexão
        </button>
      </div>
    </main>
  );
}
