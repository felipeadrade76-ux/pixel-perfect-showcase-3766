import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  criarCliente,
  criarEquipamento,
  useClientes,
  useEquipamentos,
  type Cliente,
} from "@/lib/clientes-store";
import { criarOrdem } from "@/lib/oficina-store";

export const Route = createFileRoute("/nova")({
  head: () => ({
    meta: [
      { title: "Nova entrada — Ritmeia" },
      {
        name: "description",
        content: "Cadastro rápido de máquina recebida na oficina com ordem de serviço automática.",
      },
      { property: "og:title", content: "Nova entrada — Ritmeia" },
      { property: "og:description", content: "Cadastro rápido de máquina recebida na oficina." },
    ],
  }),
  component: Nova,
});

const campo =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent";
const rotulo = "mb-1 block text-sm font-semibold text-foreground";

function Nova() {
  const navigate = useNavigate();
  const clientes = useClientes();
  const equipamentos = useEquipamentos();
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [requisicaoId] = useState(() => crypto.randomUUID());
  const [clienteRequisicaoId] = useState(() => crypto.randomUUID());
  const [equipamentoRequisicaoId] = useState(() => crypto.randomUUID());
  const [clienteId, setClienteId] = useState("");
  const [equipamentoId, setEquipamentoId] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [salvarMaquina, setSalvarMaquina] = useState(true);
  const [f, setF] = useState({
    cliente: "",
    tipoMaquina: "",
    problema: "",
    telefone: "",
    marca: "",
    modelo: "",
    serie: "",
    observacoes: "",
    prazo: "",
  });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const selecionado = clientes.find((cliente) => cliente.id === clienteId);
  const sugestoes = useMemo(() => {
    const termo = buscaCliente.trim().toLocaleLowerCase("pt-BR");
    if (!termo || clienteId) return [];
    const digitos = termo.replace(/\D/g, "");
    return clientes
      .filter((cliente) => {
        const texto = [cliente.nome, cliente.telefone, cliente.documento]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        return texto.includes(termo) || (!!digitos && texto.replace(/\D/g, "").includes(digitos));
      })
      .slice(0, 6);
  }, [buscaCliente, clienteId, clientes]);

  const maquinas = useMemo(
    () => equipamentos.filter((equipamento) => equipamento.clienteId === clienteId),
    [clienteId, equipamentos],
  );

  function selecionarCliente(cliente: Cliente) {
    setClienteId(cliente.id);
    setBuscaCliente(cliente.nome);
    setEquipamentoId("");
    setF((p) => ({
      ...p,
      cliente: cliente.nome,
      telefone: cliente.telefone ?? "",
      tipoMaquina: "",
      marca: "",
      modelo: "",
      serie: "",
    }));
  }

  function trocarCliente(value: string) {
    setBuscaCliente(value);
    setClienteId("");
    setEquipamentoId("");
    setF((p) => ({
      ...p,
      cliente: value,
      telefone: "",
      tipoMaquina: "",
      marca: "",
      modelo: "",
      serie: "",
    }));
  }

  function selecionarMaquina(id: string) {
    setEquipamentoId(id);
    if (!id) return;
    const maquina = equipamentos.find((equipamento) => equipamento.id === id);
    if (!maquina) return;
    setF((p) => ({
      ...p,
      tipoMaquina: maquina.tipo,
      marca: maquina.marca ?? "",
      modelo: maquina.modelo ?? "",
      serie: maquina.serie ?? "",
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.cliente.trim() || !f.tipoMaquina.trim() || !f.problema.trim()) {
      setErro("Preencha cliente, tipo de máquina e problema relatado.");
      return;
    }
    if (salvando) return;
    setSalvando(true);
    setErro("");
    try {
      let clienteVinculadoId = clienteId;
      if (!clienteVinculadoId) {
        const cliente = await criarCliente(
          {
            nome: f.cliente.trim(),
            telefone: f.telefone.trim() || undefined,
          },
          clienteRequisicaoId,
        );
        clienteVinculadoId = cliente.id;
      }

      let maquinaVinculadaId = equipamentoId;
      if (!maquinaVinculadaId && salvarMaquina) {
        const maquina = await criarEquipamento(
          clienteVinculadoId,
          {
            tipo: f.tipoMaquina.trim(),
            marca: f.marca.trim() || undefined,
            modelo: f.modelo.trim() || undefined,
            serie: f.serie.trim() || undefined,
          },
          equipamentoRequisicaoId,
        );
        maquinaVinculadaId = maquina.id;
      }

      const nova = await criarOrdem(
        {
          cliente: f.cliente.trim(),
          clienteId: clienteVinculadoId,
          equipamentoId: maquinaVinculadaId || undefined,
          tipoMaquina: f.tipoMaquina.trim(),
          problema: f.problema.trim(),
          telefone: f.telefone.trim() || undefined,
          marca: f.marca.trim() || undefined,
          modelo: f.modelo.trim() || undefined,
          serie: f.serie.trim() || undefined,
          observacoes: f.observacoes.trim() || undefined,
          prazo: f.prazo ? new Date(f.prazo + "T12:00:00").toISOString() : undefined,
        },
        requisicaoId,
      );
      navigate({ to: "/ordem/$id", params: { id: nova.id } });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar a ordem.");
    } finally {
      setSalvando(false);
    }
  }

  const tipos = [
    "Motosserra",
    "Roçadeira",
    "Gerador",
    "Cortador de grama",
    "Motobomba",
    "Lavadora de alta pressão",
    "Máquina agrícola",
    "Outro",
  ];

  return (
    <AppShell title="Nova entrada" subtitle="Cliente e máquina sem redigitação">
      <form onSubmit={salvar} className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5">
          <div className="mb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              Cliente
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">
              Buscar cadastro ou criar automaticamente
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cliente recorrente: selecione e a Ritmeia reaproveita os dados. Cliente novo: digite o
              nome e o cadastro será salvo junto com a primeira OS.
            </p>
          </div>

          <div className="relative">
            <label className={rotulo} htmlFor="busca-cliente">
              Nome, telefone ou CPF/CNPJ *
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3.5 left-4 h-5 w-5 text-muted-foreground"
            />
            <input
              id="busca-cliente"
              className={campo + " pl-11"}
              autoComplete="off"
              value={buscaCliente}
              onChange={(e) => trocarCliente(e.target.value)}
              placeholder="Ex.: João Pereira"
            />
            {sugestoes.length ? (
              <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                {sugestoes.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => selecionarCliente(cliente)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{cliente.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {cliente.telefone || cliente.documento || "Sem contato"}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-accent">Usar</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {selecionado ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-success/10 p-3 text-sm">
              <Check className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{selecionado.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Cadastro salvo · {selecionado.telefone || "sem telefone"}
                </p>
              </div>
              <Link
                to="/cliente/$id"
                params={{ id: selecionado.id }}
                className="shrink-0 text-xs font-bold text-accent"
              >
                Ver cadastro
              </Link>
            </div>
          ) : buscaCliente.trim() ? (
            <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <UserPlus className="h-4 w-4" /> Novo cliente
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                “{buscaCliente.trim()}” será salvo no cadastro ao criar a OS.
              </p>
              <label className="mt-3 block">
                <span className={rotulo}>Telefone</span>
                <input
                  className={campo}
                  inputMode="tel"
                  value={f.telefone}
                  onChange={set("telefone")}
                  placeholder="Opcional, mas ajuda a localizar depois"
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5">
          <div className="mb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              Máquina
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">Equipamento recebido</h2>
          </div>

          {clienteId && maquinas.length ? (
            <div className="mb-4">
              <label className={rotulo} htmlFor="maquina-cadastrada">
                Máquina já cadastrada
              </label>
              <select
                id="maquina-cadastrada"
                className={campo}
                value={equipamentoId}
                onChange={(e) => selecionarMaquina(e.target.value)}
              >
                <option value="">Cadastrar outra máquina nesta OS</option>
                {maquinas.map((maquina) => (
                  <option key={maquina.id} value={maquina.id}>
                    {maquina.apelido ? maquina.apelido + " · " : ""}
                    {maquina.tipo}
                    {maquina.marca ? " · " + maquina.marca : ""}
                    {maquina.modelo ? " " + maquina.modelo : ""}
                    {maquina.serie ? " · Série " + maquina.serie : ""}
                  </option>
                ))}
              </select>
              {equipamentoId ? (
                <p className="mt-2 text-xs text-success">
                  Dados preenchidos a partir da máquina salva no cadastro.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="tipo-maquina">
                Tipo de máquina *
              </label>
              <select id="tipo-maquina" className={campo} value={f.tipoMaquina} onChange={set("tipoMaquina")}>
                <option value="">Selecione</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={rotulo}>Marca</label>
              <input className={campo} value={f.marca} onChange={set("marca")} />
            </div>
            <div>
              <label className={rotulo}>Modelo</label>
              <input className={campo} value={f.modelo} onChange={set("modelo")} />
            </div>
            <div>
              <label className={rotulo}>Número de série</label>
              <input className={campo} value={f.serie} onChange={set("serie")} />
            </div>
          </div>

          {!equipamentoId ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/55 p-3">
              <input
                type="checkbox"
                checked={salvarMaquina}
                onChange={(e) => setSalvarMaquina(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-bold">
                  Salvar máquina no cadastro do cliente
                </span>
                <span className="block text-xs text-muted-foreground">
                  Na próxima visita, tipo, marca, modelo e série poderão ser preenchidos com um
                  toque.
                </span>
              </span>
            </label>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5">
          <div className="mb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              Serviço
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">Entrada da ordem</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className={rotulo}>Problema relatado *</label>
              <textarea
                className={campo}
                rows={3}
                value={f.problema}
                onChange={set("problema")}
                placeholder="O que o cliente relatou"
              />
            </div>
            <div>
              <label className={rotulo}>Prazo de conclusão</label>
              <input className={campo} type="date" value={f.prazo} onChange={set("prazo")} />
            </div>
            <div>
              <label className={rotulo}>Observações</label>
              <textarea
                className={campo}
                rows={2}
                value={f.observacoes}
                onChange={set("observacoes")}
              />
            </div>
          </div>
        </section>

        {erro ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {erro}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={salvando}
          className="min-h-14 w-full rounded-2xl bg-accent px-4 py-4 text-base font-extrabold text-accent-foreground shadow-sm disabled:opacity-50 active:opacity-90"
        >
          {salvando ? "Salvando cliente, máquina e OS..." : "Salvar entrada"}
        </button>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          O número da OS, a data e a hora são gerados automaticamente.
        </p>
      </form>
    </AppShell>
  );
}
