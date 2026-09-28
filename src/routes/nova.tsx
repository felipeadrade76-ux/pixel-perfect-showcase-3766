import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
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
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [requisicaoId] = useState(() => crypto.randomUUID());
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
      const nova = await criarOrdem(
        {
          cliente: f.cliente.trim(),
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
    "Máquina agrícola",
    "Outro",
  ];

  return (
    <AppShell title="Nova entrada" subtitle="Cadastro rápido da máquina">
      <form onSubmit={salvar} className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5">
          <div className="mb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              Dados principais
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">Recebimento da máquina</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className={rotulo}>Nome do cliente *</label>
              <input
                className={campo}
                value={f.cliente}
                onChange={set("cliente")}
                placeholder="Ex.: João Pereira"
              />
            </div>
            <div>
              <label className={rotulo}>Tipo de máquina *</label>
              <select className={campo} value={f.tipoMaquina} onChange={set("tipoMaquina")}>
                <option value="">Selecione</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(31,35,40,0.025)] sm:p-5">
          <div className="mb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              Complementos
            </p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">Informações opcionais</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo}>Telefone</label>
              <input
                className={campo}
                inputMode="tel"
                value={f.telefone}
                onChange={set("telefone")}
              />
            </div>
            <div>
              <label className={rotulo}>Prazo de conclusão</label>
              <input className={campo} type="date" value={f.prazo} onChange={set("prazo")} />
            </div>
            <div>
              <label className={rotulo}>Marca</label>
              <input
                className={campo}
                value={f.marca}
                onChange={set("marca")}
                placeholder="Texto livre"
              />
            </div>
            <div>
              <label className={rotulo}>Modelo</label>
              <input
                className={campo}
                value={f.modelo}
                onChange={set("modelo")}
                placeholder="Texto livre"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={rotulo}>Número de série</label>
              <input className={campo} value={f.serie} onChange={set("serie")} />
            </div>
            <div className="sm:col-span-2">
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

        {erro ? <p className="text-sm font-semibold text-destructive">{erro}</p> : null}

        <button
          type="submit"
          disabled={salvando}
          className="min-h-14 w-full rounded-2xl bg-accent px-4 py-4 text-base font-extrabold text-accent-foreground shadow-sm active:opacity-90"
        >
          {salvando ? "Salvando..." : "Salvar entrada"}
        </button>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          O número da ordem, a data e a hora são gerados automaticamente.
        </p>
      </form>
    </AppShell>
  );
}
