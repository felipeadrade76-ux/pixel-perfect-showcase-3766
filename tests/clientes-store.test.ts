import { beforeEach, expect, mock, test } from "bun:test";

let clientesRows: Record<string, unknown>[] = [];
let equipamentosRows: Record<string, unknown>[] = [];
let deferClientes = false;
let finishClientes: ((response: { data: Record<string, unknown>[]; error: null }) => void) | null =
  null;

const cliente = (i: number) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
  user_id: "user-a",
  nome: `Cliente ${String(i).padStart(4, "0")}`,
  telefone: null,
  documento: null,
  email: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  uf: null,
  observacoes: null,
  criado_em: "2026-09-28T12:00:00.000Z",
  atualizado_em: "2026-09-28T12:00:00.000Z",
});

const equipamento = (i: number) => ({
  id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, "0")}`,
  user_id: "user-a",
  cliente_id: cliente(1).id,
  tipo: "Motosserra",
  marca: null,
  modelo: null,
  serie: null,
  apelido: null,
  observacoes: null,
  criado_em: "2026-09-28T12:00:00.000Z",
  atualizado_em: "2026-09-28T12:00:00.000Z",
});

const fakeSupabase = {
  from(table: string) {
    const rows = table === "clientes" ? clientesRows : equipamentosRows;
    return {
      select() {
        return this;
      },
      order() {
        return this;
      },
      range(start: number, end: number) {
        if (table === "clientes" && deferClientes) {
          deferClientes = false;
          return new Promise<{ data: Record<string, unknown>[]; error: null }>((resolve) => {
            finishClientes = resolve;
          });
        }
        return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
      },
    };
  },
};

mock.module("@/integrations/supabase/client", () => ({ supabase: fakeSupabase }));
mock.module("react", () => ({
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

const store = await import("../src/lib/clientes-store");

beforeEach(() => {
  clientesRows = [];
  equipamentosRows = [];
  deferClientes = false;
  finishClientes = null;
  store.limparClientes();
  Object.assign(globalThis, { window: {} });
});

test("loads all customer and equipment pages", async () => {
  store.selecionarUsuarioClientes("user-a");
  clientesRows = Array.from({ length: 701 }, (_, i) => cliente(i + 1));
  equipamentosRows = Array.from({ length: 521 }, (_, i) => equipamento(i + 1));

  await store.loadClientes();

  expect(store.useClientes()).toHaveLength(701);
  expect(store.useEquipamentos()).toHaveLength(521);
});

test("does not expose previous-account customers after session switch", async () => {
  store.selecionarUsuarioClientes("user-a");
  deferClientes = true;
  const loading = store.loadClientes();

  store.selecionarUsuarioClientes("user-b");
  if (!finishClientes) throw new Error("Expected delayed customer response");
  finishClientes({ data: [cliente(1)], error: null });

  await loading;
  expect(store.useClientes()).toHaveLength(0);
  expect(store.useEquipamentos()).toHaveLength(0);
});

test("filters equipment by customer without mixing histories", () => {
  const a = cliente(1).id;
  const b = cliente(2).id;
  const list = [
    { ...equipamento(1), clienteId: a },
    { ...equipamento(2), clienteId: b },
  ] as import("../src/lib/clientes-store").Equipamento[];

  expect(store.equipamentosDoCliente(a, list)).toHaveLength(1);
  expect(store.equipamentosDoCliente(a, list)[0]?.clienteId).toBe(a);
});
