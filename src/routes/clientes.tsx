import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  criarCliente,
  dadosFiscaisCompletos,
  useClientes,
  useEquipamentos,
} from "@/lib/clientes-store";
import { useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Ritmeia" },
      {
        name: "description",
        content: "Cadastro reutilizável de clientes, máquinas e histórico de serviços.",
      },
    ],
  }),
  component: Clientes,
});

const campo =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-accent";

function Clientes() {
  const clientes = useClientes();
  const equipamentos = useEquipamentos();
  const ordens = useOrdens();
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", telefone: "", documento: "", email: "" });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return clientes;
    const digitos = termo.replace(/\D/g, "");
    return clientes.filter((cliente) => {
      const texto = [cliente.nome, cliente.telefone, cliente.documento, cliente.email]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return texto.includes(termo) || (!!digitos && texto.replace(/\D/g, "").includes(digitos));
    });
  }, [busca, clientes]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro("");
    try {
      await criarCliente({
        nome: form.nome,
        telefone: form.telefone || undefined,
        documento: form.documento || undefined,
        email: form.email || undefined,
      });
      setForm({ nome: "", telefone: "", documento: "", email: "" });
      setNovo(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell title="Clientes" subtitle="Cadastros reutilizáveis e histórico">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            />
            <span className="sr-only">Buscar cliente</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF/CNPJ ou e-mail..."
              className={campo + " pl-11"}
            />
          </label>
          <button
            type="button"
            onClick={() => setNovo((valor) => !valor)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-bold text-accent-foreground"
          >
            <Plus className="h-5 w-5" />
            Novo cliente
          </button>
        </div>

        {novo ? (
          <form
            onSubmit={salvar}
            className="rounded-2xl border border-accent/25 bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              Primeiro cadastro
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">Novo cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Salve uma vez. Nas próximas ordens, basta selecionar o cliente para preencher os dados.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                required
                aria-label="Nome do cliente"
                placeholder="Nome ou razão social *"
                className={campo}
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              />
              <input
                aria-label="Telefone do cliente"
                inputMode="tel"
                placeholder="Telefone"
                className={campo}
                value={form.telefone}
                onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
              />
              <input
                aria-label="CPF ou CNPJ"
                inputMode="numeric"
                placeholder="CPF ou CNPJ"
                className={campo}
                value={form.documento}
                onChange={(e) => setForm((p) => ({ ...p, documento: e.target.value }))}
              />
              <input
                aria-label="E-mail do cliente"
                type="email"
                placeholder="E-mail"
                className={campo}
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            {erro ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                {erro}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={salvando}
                className="min-h-11 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar cliente"}
              </button>
              <button
                type="button"
                onClick={() => setNovo(false)}
                className="min-h-11 rounded-xl border border-input px-5 font-semibold"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          {filtrados.map((cliente) => {
            const maquinas = equipamentos.filter((e) => e.clienteId === cliente.id).length;
            const servicos = ordens.filter((o) => o.clienteId === cliente.id).length;
            return (
              <Link
                key={cliente.id}
                to="/cliente/$id"
                params={{ id: cliente.id }}
                className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] transition-colors hover:border-accent/35 hover:bg-secondary/20 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-extrabold">{cliente.nome}</h2>
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[10px] font-bold " +
                          (dadosFiscaisCompletos(cliente)
                            ? "bg-success/10 text-success"
                            : "bg-secondary text-muted-foreground")
                        }
                      >
                        {dadosFiscaisCompletos(cliente)
                          ? "Dados fiscais básicos"
                          : "Fiscal a completar"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {cliente.telefone || cliente.email || "Sem contato informado"}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-muted-foreground">
                      {maquinas} {maquinas === 1 ? "máquina" : "máquinas"} · {servicos}{" "}
                      {servicos === 1 ? "serviço vinculado" : "serviços vinculados"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!filtrados.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-7 text-center">
            <p className="font-bold">Nenhum cliente encontrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o primeiro cliente ou tente outro termo de busca.
            </p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
