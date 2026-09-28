import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  criarEquipamento,
  dadosFiscaisCompletos,
  editarCliente,
  editarEquipamento,
  useCliente,
  useEquipamentos,
  type Cliente,
  type ClienteInput,
  type Equipamento,
  type EquipamentoInput,
} from "@/lib/clientes-store";
import { dataHora, useOrdens } from "@/lib/oficina-store";

export const Route = createFileRoute("/cliente/$id")({
  head: () => ({
    meta: [{ title: "Cliente — Ritmeia" }],
  }),
  component: ClienteDetalhe,
});

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-accent";
const bloco =
  "rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5";

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const cliente = useCliente(id);
  const equipamentos = useEquipamentos().filter((item) => item.clienteId === id);
  const ordens = useOrdens().filter((ordem) => ordem.clienteId === id);
  const [editando, setEditando] = useState(false);
  const [novaMaquina, setNovaMaquina] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (!cliente) {
    return (
      <AppShell title="Cliente não encontrado">
        <Link to="/clientes" className="font-semibold text-accent">
          Voltar para clientes
        </Link>
      </AppShell>
    );
  }

  async function executar(acao: () => Promise<unknown>) {
    if (ocupado) return false;
    setOcupado(true);
    setErro("");
    try {
      await acao();
      return true;
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <AppShell title={cliente.nome} subtitle="Cadastro do cliente">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/clientes" className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
          <ArrowLeft className="h-4 w-4" /> Todos os clientes
        </Link>

        <section className={bloco}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
                Cadastro mestre
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight">Dados do cliente</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Estes dados podem ser reutilizados em novas ordens e, futuramente, na emissão de
                NFS-e.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditando((valor) => !valor)}
              className="min-h-11 rounded-xl border border-input px-4 text-sm font-bold"
            >
              {editando ? "Fechar edição" : "Editar cadastro"}
            </button>
          </div>

          {editando ? (
            <ClienteForm
              cliente={cliente}
              ocupado={ocupado}
              onSalvar={async (dados) => {
                if (await executar(() => editarCliente(cliente.id, dados))) setEditando(false);
              }}
            />
          ) : (
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Telefone" valor={cliente.telefone} />
              <Info label="CPF/CNPJ" valor={cliente.documento} />
              <Info label="E-mail" valor={cliente.email} />
              <Info label="CEP" valor={cliente.cep} />
              <Info
                label="Endereço"
                valor={[cliente.logradouro, cliente.numero, cliente.complemento]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Info
                label="Cidade/UF"
                valor={[cliente.cidade, cliente.uf].filter(Boolean).join(" / ")}
              />
              <Info label="Bairro" valor={cliente.bairro} />
              <Info label="Observações" valor={cliente.observacoes} />
            </div>
          )}

          <div
            className={
              "mt-4 rounded-xl p-3 text-sm " +
              (dadosFiscaisCompletos(cliente)
                ? "bg-success/10 text-success"
                : "bg-secondary text-muted-foreground")
            }
          >
            {dadosFiscaisCompletos(cliente)
              ? "Dados fiscais básicos preenchidos. A integração de NFS-e poderá reutilizá-los."
              : "Preparação fiscal incompleta. Documento e cidade/UF podem ser completados quando necessários para NFS-e."}
          </div>
          {erro ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
              {erro}
            </p>
          ) : null}
        </section>

        <section className={bloco}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
                Máquinas
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight">
                Equipamentos do cliente ({equipamentos.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setNovaMaquina((valor) => !valor)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar máquina
            </button>
          </div>

          {novaMaquina ? (
            <EquipamentoForm
              ocupado={ocupado}
              onSalvar={async (dados) => {
                if (await executar(() => criarEquipamento(cliente.id, dados))) setNovaMaquina(false);
              }}
            />
          ) : null}

          <div className="mt-4 space-y-3">
            {equipamentos.map((equipamento) => (
              <EquipamentoCard
                key={equipamento.id}
                equipamento={equipamento}
                ocupado={ocupado}
                onSalvar={(dados) =>
                  executar(() => editarEquipamento(equipamento.id, cliente.id, dados))
                }
              />
            ))}
            {!equipamentos.length && !novaMaquina ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhuma máquina salva. Ao cadastrar uma, ela poderá preencher automaticamente a
                próxima OS.
              </p>
            ) : null}
          </div>
        </section>

        <section className={bloco}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Histórico
          </p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight">
            Serviços vinculados ({ordens.length})
          </h2>
          <div className="mt-4 space-y-2">
            {[...ordens]
              .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
              .map((ordem) => (
                <Link
                  key={ordem.id}
                  to="/ordem/$id"
                  params={{ id: ordem.id }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 hover:bg-secondary/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {ordem.numero} · {ordem.tipoMaquina}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ordem.marca || "Sem marca"} {ordem.modelo || ""} · {dataHora(ordem.criadaEm)}
                    </p>
                  </div>
                  <StatusBadge status={ordem.status} />
                </Link>
              ))}
            {!ordens.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma ordem vinculada a este cadastro ainda.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Info({ label, valor }: { label: string; valor?: string | undefined }) {
  return (
    <div className="rounded-xl bg-secondary/55 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold">{valor?.trim() || "Não informado"}</p>
    </div>
  );
}

function ClienteForm({
  cliente,
  ocupado,
  onSalvar,
}: {
  cliente: Cliente;
  ocupado: boolean;
  onSalvar: (dados: Partial<ClienteInput>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    nome: cliente.nome,
    telefone: cliente.telefone ?? "",
    documento: cliente.documento ?? "",
    email: cliente.email ?? "",
    cep: cliente.cep ?? "",
    logradouro: cliente.logradouro ?? "",
    numero: cliente.numero ?? "",
    complemento: cliente.complemento ?? "",
    bairro: cliente.bairro ?? "",
    cidade: cliente.cidade ?? "",
    uf: cliente.uf ?? "",
    observacoes: cliente.observacoes ?? "",
  });

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {([
        ["nome", "Nome ou razão social"],
        ["telefone", "Telefone"],
        ["documento", "CPF ou CNPJ"],
        ["email", "E-mail"],
        ["cep", "CEP"],
        ["logradouro", "Logradouro"],
        ["numero", "Número"],
        ["complemento", "Complemento"],
        ["bairro", "Bairro"],
        ["cidade", "Cidade"],
        ["uf", "UF"],
      ] as const).map(([key, label]) => (
        <label key={key}>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
          <input
            className={campo}
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
          />
        </label>
      ))}
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Observações</span>
        <textarea
          rows={3}
          className={campo}
          value={form.observacoes}
          onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
        />
      </label>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => onSalvar(form)}
        className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50 sm:col-span-2"
      >
        {ocupado ? "Salvando..." : "Salvar cadastro"}
      </button>
    </div>
  );
}

function EquipamentoForm({
  inicial,
  ocupado,
  onSalvar,
  onCancelar,
}: {
  inicial?: Equipamento;
  ocupado: boolean;
  onSalvar: (dados: EquipamentoInput) => Promise<unknown>;
  onCancelar?: () => void;
}) {
  const [form, setForm] = useState({
    tipo: inicial?.tipo ?? "",
    marca: inicial?.marca ?? "",
    modelo: inicial?.modelo ?? "",
    serie: inicial?.serie ?? "",
    apelido: inicial?.apelido ?? "",
    observacoes: inicial?.observacoes ?? "",
  });

  return (
    <div className="mt-4 grid gap-3 rounded-xl bg-secondary/45 p-3 sm:grid-cols-2">
      <input
        required
        aria-label="Tipo da máquina"
        placeholder="Tipo da máquina *"
        className={campo}
        value={form.tipo}
        onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
      />
      <input
        aria-label="Apelido da máquina"
        placeholder="Apelido (opcional)"
        className={campo}
        value={form.apelido}
        onChange={(e) => setForm((p) => ({ ...p, apelido: e.target.value }))}
      />
      <input
        placeholder="Marca"
        className={campo}
        value={form.marca}
        onChange={(e) => setForm((p) => ({ ...p, marca: e.target.value }))}
      />
      <input
        placeholder="Modelo"
        className={campo}
        value={form.modelo}
        onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))}
      />
      <input
        placeholder="Número de série"
        className={campo}
        value={form.serie}
        onChange={(e) => setForm((p) => ({ ...p, serie: e.target.value }))}
      />
      <input
        placeholder="Observações da máquina"
        className={campo}
        value={form.observacoes}
        onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
      />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={ocupado || !form.tipo.trim()}
          onClick={() => onSalvar(form)}
          className="min-h-11 rounded-xl bg-accent px-4 font-bold text-accent-foreground disabled:opacity-50"
        >
          {ocupado ? "Salvando..." : inicial ? "Salvar máquina" : "Adicionar máquina"}
        </button>
        {onCancelar ? (
          <button
            type="button"
            onClick={onCancelar}
            className="min-h-11 rounded-xl border border-input px-4 font-semibold"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EquipamentoCard({
  equipamento,
  ocupado,
  onSalvar,
}: {
  equipamento: Equipamento;
  ocupado: boolean;
  onSalvar: (dados: EquipamentoInput) => Promise<unknown>;
}) {
  const [editando, setEditando] = useState(false);
  const descricao = useMemo(
    () => [equipamento.marca, equipamento.modelo].filter(Boolean).join(" ") || "Sem marca/modelo",
    [equipamento],
  );
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Wrench className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {equipamento.apelido || equipamento.tipo}
            {equipamento.apelido ? <span className="font-normal"> · {equipamento.tipo}</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">{descricao}</p>
          {equipamento.serie ? (
            <p className="text-xs text-muted-foreground">Série: {equipamento.serie}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setEditando((valor) => !valor)}
          className="min-h-10 rounded-lg px-3 text-xs font-bold text-accent"
        >
          {editando ? "Fechar" : "Editar"}
        </button>
      </div>
      {editando ? (
        <EquipamentoForm
          inicial={equipamento}
          ocupado={ocupado}
          onCancelar={() => setEditando(false)}
          onSalvar={async (dados) => {
            await onSalvar(dados);
            setEditando(false);
          }}
        />
      ) : null}
    </div>
  );
}
