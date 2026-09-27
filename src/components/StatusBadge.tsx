import type { Status } from "@/lib/oficina-store";

const cores: Record<Status, string> = {
  Recebida: "bg-secondary text-secondary-foreground",
  "Em diagnóstico": "bg-primary/10 text-primary",
  "Aguardando aprovação": "bg-warning/20 text-warning-foreground",
  "Aguardando peças": "bg-warning/20 text-warning-foreground",
  "Em manutenção": "bg-primary text-primary-foreground",
  Pronta: "bg-success text-success-foreground",
  Entregue: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cores[status]}`}
    >
      {status}
    </span>
  );
}
