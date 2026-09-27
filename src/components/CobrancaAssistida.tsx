import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrdens, moeda, saldo, type Ordem } from "@/lib/oficina-store";
import type { Database } from "@/integrations/supabase/types";

type Cobranca = Database["public"]["Tables"]["cobrancas"]["Row"];
type Forma = "Pix" | "Dinheiro" | "Cartão";
const campo = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base";

export function CobrancaAssistida({ ordem }: { ordem: Ordem }) {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<Forma>("Pix");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [recarregar, setRecarregar] = useState(0);
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(true);
  const tentativa = useRef<{ id: string; valor: number; forma: Forma } | null>(null);

  useEffect(() => {
    let ativo = true;
    setCobrancas([]);
    setCarregandoCobrancas(true);
    supabase
      .from("cobrancas")
      .select("*")
      .eq("ordem_id", ordem.id)
      .order("criada_em", { ascending: false })
      .then(({ data, error }) => {
        if (!ativo) return;
        setCarregandoCobrancas(false);
        if (error) setErro("Não foi possível consultar as cobranças. Tente novamente.");
        else setCobrancas(data ?? []);
      });
    return () => {
      ativo = false;
    };
  }, [ordem.id, recarregar]);

  const pendentes = cobrancas.filter((c) => c.status === "aguardando" || c.status === "informado");
  const comprometido = pendentes.reduce((s, c) => s + Number(c.valor), 0);
  const disponivel = Math.max(0, Math.round((saldo(ordem) - comprometido) * 100) / 100);

  async function executar(fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await fn();
      setRecarregar((n) => n + 1);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setOcupado(false);
    }
  }

  function solicitar() {
    void executar(async () => {
      const v = Number(valor.replace(",", "."));
      const retomada = tentativa.current?.valor === v && tentativa.current.forma === forma;
      if (
        !Number.isFinite(v) ||
        v <= 0 ||
        Math.abs(v * 100 - Math.round(v * 100)) > 1e-7 ||
        (!retomada && v > disponivel)
      ) {
        throw new Error(
          "Informe um valor positivo, em centavos, até o saldo ainda não solicitado.",
        );
      }
      const id =
        tentativa.current?.valor === v && tentativa.current.forma === forma
          ? tentativa.current.id
          : crypto.randomUUID();
      tentativa.current = { id, valor: v, forma };
      const { error } = await supabase.rpc("oficinia_criar_cobranca", {
        p_ordem: ordem.id,
        p_id: id,
        p_valor: v,
        p_forma: forma,
      });
      if (error)
        throw new Error(
          "Cobrança não confirmada. Confira a conexão e tente novamente com os mesmos dados.",
        );
      tentativa.current = null;
      setValor("");
      setAviso("Cobrança criada. Ela não representa dinheiro recebido.");
    });
  }

  function transicao(id: string, estado: "informado" | "cancelado") {
    void executar(async () => {
      const { error } = await supabase.rpc("oficinia_marcar_cobranca", {
        p_cobranca: id,
        p_estado: estado,
      });
      if (error) throw new Error(error.message);
      setAviso(
        estado === "informado"
          ? "Aviso de pagamento registrado; falta conferir o recebimento."
          : "Cobrança cancelada.",
      );
    });
  }

  function confirmar(id: string) {
    void executar(async () => {
      if (
        !window.confirm(
          "Você conferiu o recebimento fora da OficinIA? Confirmar fará a baixa definitiva.",
        )
      )
        return;
      const { error } = await supabase.rpc("oficinia_confirmar_cobranca", { p_cobranca: id });
      if (error) throw new Error(error.message);
      try {
        await loadOrdens();
        setAviso("Recebimento confirmado manualmente e saldo atualizado.");
      } catch {
        setAviso("Recebimento confirmado no banco. Não foi possível atualizar a tela; recarregue para ver o saldo.");
      }
    });
  }

  async function copiar(c: Cobranca) {
    const texto = `Olá, ${ordem.cliente}! Referente à ${ordem.numero}, o valor solicitado é ${moeda(Number(c.valor))} (${c.forma}). Após realizar o pagamento pelo meio já combinado, avise a oficina. A confirmação será feita após conferência do recebimento.`;
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Mensagem copiada. Envie pelo WhatsApp ou outro canal.");
    } catch {
      setErro("Não foi possível copiar. Confira a permissão do navegador.");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold">Cobranças assistidas</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sem conta bancária, chave Pix ou conexão com banco. A OficinIA organiza os pedidos; apenas a
        confirmação manual altera o valor recebido.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <input
          aria-label="Valor da cobrança"
          className={campo}
          inputMode="decimal"
          placeholder="Valor R$"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <select
          aria-label="Forma da cobrança"
          className={campo}
          value={forma}
          onChange={(e) => setForma(e.target.value as Forma)}
        >
          <option>Pix</option>
          <option>Dinheiro</option>
          <option>Cartão</option>
        </select>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Saldo disponível para novas cobranças: {moeda(disponivel)}
      </p>
      <button
        disabled={ocupado || carregandoCobrancas || (disponivel <= 0 && !tentativa.current)}
        onClick={solicitar}
        className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
      >
        {ocupado ? "Aguarde..." : "Preparar cobrança"}
      </button>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-3 text-sm text-accent">
          {aviso}
        </p>
      )}
      {carregandoCobrancas && <p role="status" className="mt-3 text-sm text-muted-foreground">Consultando cobranças...</p>}
      {!carregandoCobrancas && erro && <button type="button" onClick={() => setRecarregar((n) => n + 1)} className="mt-2 rounded-lg border border-input px-3 py-2 text-xs font-semibold">Atualizar cobranças</button>}
      <div className="mt-4 space-y-3">
        {cobrancas.map((c) => (
          <div key={c.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {moeda(Number(c.valor))} · {c.forma}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.criada_em).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="text-xs font-semibold">
                {c.status === "aguardando"
                  ? "Aguardando"
                  : c.status === "informado"
                    ? "Cliente informou"
                    : c.status === "confirmado"
                      ? "Confirmado manualmente"
                      : "Cancelada"}
              </span>
            </div>
            {(c.status === "aguardando" || c.status === "informado") && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={ocupado}
                  onClick={() => void copiar(c)}
                  className="rounded-lg border border-input px-3 py-2 text-xs font-semibold"
                >
                  Copiar mensagem
                </button>
                {c.status === "aguardando" && (
                  <button
                    disabled={ocupado}
                    onClick={() => transicao(c.id, "informado")}
                    className="rounded-lg border border-input px-3 py-2 text-xs font-semibold"
                  >
                    Cliente avisou que pagou
                  </button>
                )}
                <button
                  disabled={ocupado}
                  onClick={() => confirmar(c.id)}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
                >
                  Confirmar após conferir
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => transicao(c.id, "cancelado")}
                  className="rounded-lg border border-destructive px-3 py-2 text-xs text-destructive"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
        {!carregandoCobrancas && !erro && cobrancas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma cobrança preparada nesta ordem.</p>
        )}
      </div>
    </section>
  );
}
