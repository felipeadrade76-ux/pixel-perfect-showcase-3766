import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  STATUSES,
  adicionarItem,
  alterarStatus,
  dataHora,
  editarOrdem,
  excluirOrdem,
  moeda,
  pago,
  registrarPagamento,
  removerItem,
  saldo,
  total,
  useOrdem,
  type Status,
} from "@/lib/oficina-store";

export const Route = createFileRoute("/ordem/$id")({
  head: () => ({
    meta: [
      { title: "Ordem de serviço — Oficina Inteligente" },
      {
        name: "description",
        content:
          "Detalhes da ordem: status, histórico automático, peças, mão de obra e pagamentos.",
      },
      { property: "og:title", content: "Ordem de serviço — Oficina Inteligente" },
      { property: "og:description", content: "Detalhes e histórico da ordem de serviço." },
    ],
  }),
  component: Detalhe,
});

const campo =
  "w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:border-accent";
const bloco = "rounded-2xl border border-border bg-card p-4";

function Detalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const ordem = useOrdem(id);
  const [editando, setEditando] = useState(false);
  const [item, setItem] = useState({ descricao: "", tipo: "Peça", valor: "" });
  const [pgto, setPgto] = useState({ valor: "", forma: "Pix" });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [erroPagamento, setErroPagamento] = useState("");
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [erroOrdem, setErroOrdem] = useState("");

  async function executarAlteracao(acao: () => Promise<void>): Promise<boolean> {
    if (salvandoOrdem || salvandoPagamento) return false;
    setSalvandoOrdem(true);
    setErroOrdem("");
    try {
      await acao();
      return true;
    } catch (error) {
      setErroOrdem(error instanceof Error ? error.message : "Não foi possível salvar a alteração.");
      return false;
    } finally {
      setSalvandoOrdem(false);
    }
  }

  if (!ordem) {
    return (
      <AppShell title="Ordem não encontrada">
        <Link to="/ordens" className="font-semibold text-accent">
          Voltar para as ordens
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell title={`${ordem.numero} · ${ordem.cliente}`} subtitle={ordem.tipoMaquina}>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          to="/ordens"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Todas as ordens
        </Link>

        <section className={bloco}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <p className="truncate text-sm font-semibold text-muted-foreground">
              Entrada em {dataHora(ordem.criadaEm)}
            </p>
            <StatusBadge status={ordem.status} />
          </div>
          <label className="mb-1 mt-4 block text-sm font-semibold">Alterar status</label>
          <select
            className={campo}
            value={ordem.status}
            disabled={salvandoOrdem || salvandoPagamento}
            onChange={(e) =>
              void executarAlteracao(() => alterarStatus(ordem.id, e.target.value as Status))
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </section>

        <section className={bloco}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Dados da máquina</h2>
            <button
              onClick={() => setEditando((v) => !v)}
              className="text-sm font-semibold text-accent"
            >
              {editando ? "Fechar" : "Editar"}
            </button>
          </div>
          {editando ? (
            <EditarForm
              ordem={ordem}
              onSalvar={async (dados) => {
                if (await executarAlteracao(() => editarOrdem(ordem.id, dados))) setEditando(false);
              }}
            />
          ) : (
            <dl className="space-y-1 text-sm">
              <Linha k="Cliente" v={ordem.cliente} />
              <Linha k="Telefone" v={ordem.telefone} />
              <Linha
                k="Máquina"
                v={`${ordem.tipoMaquina} ${ordem.marca ?? ""} ${ordem.modelo ?? ""}`}
              />
              <Linha k="Nº de série" v={ordem.serie} />
              <Linha k="Problema" v={ordem.problema} />
              <Linha k="Observações" v={ordem.observacoes} />
              <Linha k="Previsão" v={ordem.prazo ? dataHora(ordem.prazo) : undefined} />
              <Linha
                k="Concluída em"
                v={ordem.concluidaEm ? dataHora(ordem.concluidaEm) : undefined}
              />
            </dl>
          )}
        </section>

        {erroOrdem ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive p-3 text-sm text-destructive"
          >
            {erroOrdem}
          </p>
        ) : null}
        {salvandoOrdem ? (
          <p role="status" className="text-sm text-muted-foreground">
            Salvando alteração...
          </p>
        ) : null}
        <section className={bloco}>
          <h2 className="mb-3 font-bold">Peças e mão de obra</h2>
          <div className="space-y-2">
            {ordem.itens.map((i) => (
              <div
                key={i.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
              >
                <span className="truncate text-sm">
                  {i.descricao} <span className="text-muted-foreground">({i.tipo})</span>
                </span>
                <span className="text-sm font-semibold">{moeda(i.valor)}</span>
                <button
                  disabled={salvandoOrdem || salvandoPagamento}
                  onClick={() => void executarAlteracao(() => removerItem(ordem.id, i.id))}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))}
            {ordem.itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item lançado.</p>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            <input
              className={campo}
              placeholder="Descrição"
              value={item.descricao}
              onChange={(e) => setItem((p) => ({ ...p, descricao: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className={campo}
                value={item.tipo}
                onChange={(e) => setItem((p) => ({ ...p, tipo: e.target.value }))}
              >
                <option>Peça</option>
                <option>Mão de obra</option>
              </select>
              <input
                className={campo}
                inputMode="decimal"
                placeholder="Valor R$"
                value={item.valor}
                onChange={(e) => setItem((p) => ({ ...p, valor: e.target.value }))}
              />
            </div>
            <button
              disabled={salvandoOrdem || salvandoPagamento}
              onClick={async () => {
                const valor = Number(item.valor.replace(",", "."));
                if (!item.descricao.trim() || !Number.isFinite(valor) || valor < 0) {
                  setErroOrdem("Informe uma descrição e um valor válido.");
                  return;
                }
                const ok = await executarAlteracao(() =>
                  adicionarItem(ordem.id, {
                    descricao: item.descricao.trim(),
                    tipo: item.tipo as "Peça" | "Mão de obra",
                    valor,
                  }),
                );
                if (ok) setItem({ descricao: "", tipo: "Peça", valor: "" });
              }}
              className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground"
            >
              Adicionar item
            </button>
          </div>

          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm font-semibold">
            <div className="flex justify-between">
              <span>Total</span>
              <span>{moeda(total(ordem))}</span>
            </div>
            <div className="flex justify-between text-accent">
              <span>Pago</span>
              <span>{moeda(pago(ordem))}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>Saldo pendente</span>
              <span>{moeda(saldo(ordem))}</span>
            </div>
          </div>
        </section>

        <section className={bloco}>
          <h2 className="mb-3 font-bold">Pagamentos</h2>
          {ordem.pagamentos.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {p.forma} · {dataHora(p.data)}
              </span>
              <span className="font-semibold">{moeda(p.valor)}</span>
            </div>
          ))}
          {ordem.pagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input
              className={campo}
              inputMode="decimal"
              placeholder="Valor R$"
              value={pgto.valor}
              onChange={(e) => setPgto((p) => ({ ...p, valor: e.target.value }))}
            />
            <select
              className={campo}
              value={pgto.forma}
              onChange={(e) => setPgto((p) => ({ ...p, forma: e.target.value }))}
            >
              <option>Pix</option>
              <option>Dinheiro</option>
              <option>Cartão</option>
            </select>
          </div>
          <button
            disabled={salvandoPagamento || salvandoOrdem}
            onClick={async () => {
              const valor = Number(pgto.valor.replace(",", "."));
              setErroPagamento("");
              if (
                !Number.isFinite(valor) ||
                valor <= 0 ||
                Math.round(valor * 100) > Math.round(saldo(ordem) * 100)
              ) {
                setErroPagamento("Informe um valor positivo que não ultrapasse o saldo pendente.");
                return;
              }
              setSalvandoPagamento(true);
              try {
                await registrarPagamento(
                  ordem.id,
                  valor,
                  pgto.forma as "Pix" | "Dinheiro" | "Cartão",
                );
                setPgto({ valor: "", forma: pgto.forma });
              } catch (error) {
                setErroPagamento(
                  error instanceof Error ? error.message : "Falha ao registrar o pagamento.",
                );
              } finally {
                setSalvandoPagamento(false);
              }
            }}
            className="mt-2 w-full rounded-xl bg-accent py-3 font-bold text-accent-foreground disabled:opacity-50"
          >
            {salvandoPagamento ? "Salvando..." : "Registrar pagamento"}
          </button>
          {erroPagamento ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {erroPagamento}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Confirme o recebimento no banco ou maquininha antes de registrar. O Pix não tem baixa
            automática nesta versão.
          </p>
        </section>

        <section className={bloco}>
          <h2 className="mb-2 font-bold">Excluir ordem</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            A exclusão é irreversível. Ordens com pagamentos não podem ser excluídas.
          </p>
          <button
            disabled={salvandoOrdem || salvandoPagamento || ordem.pagamentos.length > 0}
            className="rounded-xl border border-destructive px-4 py-3 text-sm font-semibold text-destructive disabled:opacity-50"
            onClick={async () => {
              if (!window.confirm("Excluir definitivamente esta ordem de serviço sem pagamentos?"))
                return;
              if (await executarAlteracao(() => excluirOrdem(ordem.id))) {
                navigate({ to: "/ordens" });
              }
            }}
          >
            Excluir ordem sem pagamentos
          </button>
        </section>

        <section className={bloco}>
          <h2 className="mb-3 font-bold">Histórico automático</h2>
          <ol className="space-y-3">
            {[...ordem.historico].reverse().map((h, i) => (
              <li key={i} className="border-l-2 border-accent pl-3">
                <p className="text-sm font-semibold text-foreground">{h.texto}</p>
                <p className="text-xs text-muted-foreground">{dataHora(h.data)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}

function Linha({ k, v }: { k: string; v?: string | undefined }) {
  if (!v || !v.trim()) return null;
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground">{v}</dd>
    </div>
  );
}

function EditarForm({
  ordem,
  onSalvar,
}: {
  ordem: import("@/lib/oficina-store").Ordem;
  onSalvar: (dados: Partial<import("@/lib/oficina-store").Ordem>) => Promise<void>;
}) {
  const [f, setF] = useState({
    cliente: ordem.cliente,
    telefone: ordem.telefone ?? "",
    marca: ordem.marca ?? "",
    modelo: ordem.modelo ?? "",
    problema: ordem.problema,
    observacoes: ordem.observacoes ?? "",
    prazo: ordem.prazo ? ordem.prazo.slice(0, 10) : "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-2">
      <input className={campo} value={f.cliente} onChange={set("cliente")} placeholder="Cliente" />
      <input
        className={campo}
        value={f.telefone}
        onChange={set("telefone")}
        placeholder="Telefone"
      />
      <div className="grid grid-cols-2 gap-2">
        <input className={campo} value={f.marca} onChange={set("marca")} placeholder="Marca" />
        <input className={campo} value={f.modelo} onChange={set("modelo")} placeholder="Modelo" />
      </div>
      <textarea className={campo} rows={2} value={f.problema} onChange={set("problema")} />
      <textarea
        className={campo}
        rows={2}
        value={f.observacoes}
        onChange={set("observacoes")}
        placeholder="Observações"
      />
      <input className={campo} type="date" value={f.prazo} onChange={set("prazo")} />
      <button
        onClick={() =>
          onSalvar({
            cliente: f.cliente.trim(),
            telefone: f.telefone.trim() || undefined,
            marca: f.marca.trim() || undefined,
            modelo: f.modelo.trim() || undefined,
            problema: f.problema.trim(),
            observacoes: f.observacoes.trim() || undefined,
            prazo: f.prazo ? new Date(f.prazo + "T12:00:00").toISOString() : undefined,
          })
        }
        className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground"
      >
        Salvar alterações
      </button>
    </div>
  );
}
