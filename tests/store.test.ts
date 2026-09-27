import { beforeEach, expect, mock, test } from "bun:test";

// Isolate store business logic from network calls and React's rendering runtime.
let rows: Record<string, unknown>[] = [];
let deferRange = false;
let finishRange: ((response: { data: Record<string, unknown>[]; error: null }) => void) | null =
  null;
let rpcShouldFail = false;
let deferInsert = false;
let finishInsert: ((response: { data: Record<string, unknown>; error: null }) => void) | null = null;
let errorFromPage = -1;
const rpcIds: string[] = [];
const row = (i: number) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
  numero: `OS-${String(i).padStart(4, "0")}`,
  revisao: 0,
  cliente: `Teste ${i}`,
  telefone: null,
  tipo_maquina: "Motosserra",
  marca: null,
  modelo: null,
  serie: null,
  problema: "Teste",
  observacoes: null,
  prazo: null,
  status: "Recebida",
  criada_em: "2026-09-27T12:00:00.000Z",
  concluida_em: null,
  entregue_em: null,
  historico: [],
  itens: [{ id: "item", descricao: "Peça", tipo: "Peça", valor: 100 }],
  pagamentos: [],
});

const fakeSupabase = {
  from(table: string) {
    if (table !== "ordens") throw new Error("Unexpected table: " + table);
    return {
      insert(_item: Record<string, unknown>) {
        return this;
      },
      single() {
        if (!deferInsert) return Promise.resolve({ data: row(1), error: null });
        deferInsert = false;
        return new Promise<{ data: Record<string, unknown>; error: null }>((resolve) => {
          finishInsert = resolve;
        });
      },
      select() {
        return this;
      },
      order() {
        return this;
      },
      range(start: number, end: number) {
        if (start === errorFromPage) return Promise.resolve({ data: null, error: { message: "Falha de rede" } });
        if (deferRange) {
          deferRange = false;
          return new Promise<{ data: Record<string, unknown>[]; error: null }>((resolve) => {
            finishRange = resolve;
          });
        }
        return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
      },
    };
  },
  async rpc(_name: string, args: { p_pagamento_id: string }) {
    rpcIds.push(args.p_pagamento_id);
    if (rpcShouldFail) return { data: null, error: { message: "Falha temporária" } };
    return { data: row(1), error: null };
  },
};
mock.module("@/integrations/supabase/client", () => ({ supabase: fakeSupabase }));
mock.module("react", () => ({
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

// The store is imported only AFTER module mocks have been registered.
const store = await import("../src/lib/oficina-store");

beforeEach(() => {
  rows = [];
  deferRange = false;
  finishRange = null;
  rpcShouldFail = false;
  deferInsert = false;
  finishInsert = null;
  errorFromPage = -1;
  rpcIds.length = 0;
  store.limparOrdens();
  Object.assign(globalThis, { window: {} });
});

test("loads every page, not only Supabase's first 1,000 rows", async () => {
  store.selecionarUsuario("user-a");
  rows = Array.from({ length: 1201 }, (_, i) => row(i + 1));
  await store.loadOrdens();
  expect(store.useOrdens()).toHaveLength(1201);
});

test("ignores an old account's database reply after logout", async () => {
  store.selecionarUsuario("user-a");
  deferRange = true;
  const loading = store.loadOrdens();
  store.limparOrdens();
  if (!finishRange) throw new Error("Expected delayed network response");
  finishRange({ data: [row(1)], error: null });
  await loading;
  expect(store.useOrdens()).toHaveLength(0);
});

test("does not expose a newly created order after switching accounts mid-request", async () => {
  store.selecionarUsuario("user-a");
  deferInsert = true;
  const creating = store.criarOrdem({
    cliente: "Auditoria",
    tipoMaquina: "Gerador",
    problema: "Não funciona",
  });
  store.selecionarUsuario("user-b");
  if (!finishInsert) throw new Error("Expected delayed order creation");
  finishInsert({ data: row(1), error: null });
  await expect(creating).rejects.toThrow("sessão mudou");
  expect(store.useOrdens()).toHaveLength(0);
});

test("does not display a partial list when later pagination fails", async () => {
  store.selecionarUsuario("user-a");
  rows = [row(1)];
  await store.loadOrdens();
  rows = Array.from({ length: 701 }, (_, i) => row(i + 1));
  errorFromPage = 500;
  await expect(store.loadOrdens()).rejects.toThrow("Falha ao carregar");
  expect(store.useOrdens()).toHaveLength(1);
});

test("retries uncertain payment with same ID and clears it on account switch", async () => {
  store.selecionarUsuario("user-a");
  rpcShouldFail = true;
  await expect(store.registrarPagamento(row(1).id, 10, "Pix")).rejects.toThrow();
  rpcShouldFail = false;
  await store.registrarPagamento(row(1).id, 10, "Pix");
  expect(rpcIds).toHaveLength(2);
  expect(rpcIds[0]).toBe(rpcIds[1]);

  store.selecionarUsuario("user-b");
  await store.registrarPagamento(row(1).id, 10, "Pix");
  expect(rpcIds[2]).not.toBe(rpcIds[0]);
});

test("rejects invalid money before touching the RPC", async () => {
  store.selecionarUsuario("user-a");
  await expect(store.registrarPagamento(row(1).id, 0.001, "Pix")).rejects.toThrow();
  await expect(store.registrarPagamento(row(1).id, -1, "Pix")).rejects.toThrow();
  expect(rpcIds).toHaveLength(0);
});
