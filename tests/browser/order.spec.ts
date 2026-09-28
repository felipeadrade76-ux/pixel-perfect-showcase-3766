import { expect, test } from "@playwright/test";

test("an authenticated user can create an OS and reopen it in a mobile viewport", async ({
  page,
}) => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "auditoria@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-27T12:00:00.000Z",
  };
  await page.addInitScript((u) => {
    const encode = (obj: object) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const expiration = Math.floor(Date.now() / 1000) + 7200;
    const token =
      encode({ alg: "HS256", typ: "JWT" }) +
      "." +
      encode({ sub: u.id, aud: "authenticated", role: "authenticated", exp: expiration }) +
      ".fakesignature";
    localStorage.setItem(
      "sb-example-auth-token",
      JSON.stringify({
        access_token: token,
        refresh_token: "fake-refresh-token",
        token_type: "bearer",
        expires_in: 7200,
        expires_at: expiration,
        user: u,
      }),
    );
  }, user);

  let saved: Record<string, unknown> | null = null;
  let charge: Record<string, unknown> | null = null;
  await page.route("https://example.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/rest/v1/ordens") {
      if (route.request().method() === "POST") {
        const posted = JSON.parse(route.request().postData() ?? "{}");
        saved = {
          telefone: null,
          marca: null,
          modelo: null,
          serie: null,
          observacoes: null,
          prazo: null,
          concluida_em: null,
          entregue_em: null,
          ...posted,
          user_id: userId,
          numero: "OS-0001",
          revisao: 0,
        };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(saved),
        });
      } else if (route.request().method() === "PATCH") {
        saved = {
          ...saved,
          ...JSON.parse(route.request().postData() ?? "{}"),
          revisao: Number(saved?.revisao ?? 0) + 1,
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(saved),
        });
      } else {
        const single = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(single ? saved : saved ? [saved] : []),
        });
      }
    } else if (url.pathname === "/rest/v1/cobrancas") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(charge ? [charge] : []),
      });
    } else if (url.pathname === "/rest/v1/rpc/oficinia_criar_cobranca") {
      const input = JSON.parse(route.request().postData() ?? "{}");
      charge = {
        id: input.p_id,
        user_id: userId,
        ordem_id: input.p_ordem,
        valor: input.p_valor,
        forma: input.p_forma,
        status: "aguardando",
        criada_em: "2026-09-27T12:10:00.000Z",
        informada_em: null,
        confirmada_em: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(charge),
      });
    } else if (url.pathname === "/rest/v1/rpc/oficinia_marcar_cobranca") {
      charge = { ...charge, status: "informado", informada_em: "2026-09-27T12:11:00.000Z" };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(charge),
      });
    } else if (url.pathname === "/rest/v1/rpc/oficinia_confirmar_cobranca") {
      charge = { ...charge, status: "confirmado", confirmada_em: "2026-09-27T12:12:00.000Z" };
      saved = {
        ...saved,
        revisao: Number(saved?.revisao ?? 0) + 1,
        pagamentos: [
          ...((saved?.pagamentos as unknown[]) ?? []),
          { id: charge.id, valor: charge.valor, forma: charge.forma, data: charge.confirmada_em },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(charge),
      });
    } else if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Nenhuma máquina na oficina no momento.")).toBeVisible();

  await page.getByRole("link", { name: "Nova entrada" }).first().click();
  await page.locator('input[placeholder="Ex.: João Pereira"]').fill("Cliente de teste");
  await page.locator("form select").selectOption("Motosserra");
  await page.locator('textarea[placeholder="O que o cliente relatou"]').fill("Motor não liga");
  await page.getByRole("button", { name: "Salvar entrada" }).click();

  await expect(page).toHaveURL(/\/ordem\//);
  await expect(page.getByText("OS-0001").first()).toBeVisible();
  await expect(page.getByText("Cliente de teste").first()).toBeVisible();
  expect(saved).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  // Real browser interaction; Supabase responses are controlled by this test.
  const itens = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Peças e mão de obra" }) });
  await itens.locator('input[placeholder="Descrição"]').fill("Reparo");
  await itens.locator('input[placeholder="Valor R$"]').fill("100");
  await itens.getByRole("button", { name: "Adicionar item" }).click();
  await expect(itens).toContainText("R$ 100,00");

  const cobrancas = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Cobranças assistidas" }) });
  await cobrancas.getByRole("textbox", { name: "Valor da cobrança" }).fill("60");
  await cobrancas.getByRole("button", { name: "Preparar cobrança" }).click();
  await expect(cobrancas.getByRole("button", { name: "Cliente avisou que pagou" })).toBeVisible();
  await cobrancas.getByRole("button", { name: "Cliente avisou que pagou" }).click();
  await expect(cobrancas).toContainText("Cliente informou");
  await expect(itens).toContainText("R$ 100,00");
  await expect(itens).toContainText("R$ 0,00");

  page.once("dialog", (dialog) => void dialog.accept());
  await cobrancas.getByRole("button", { name: "Confirmar após conferir" }).click();
  await expect(cobrancas).toContainText("Confirmado manualmente");
  await expect(itens).toContainText("R$ 60,00");
  await expect(itens).toContainText("R$ 40,00");

  await page.getByRole("link", { name: "Financeiro" }).first().click();
  await expect(page.getByText("Recebido no mês")).toBeVisible();
  await expect(page.getByText("R$ 60,00").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.getByRole("link", { name: "Agenda" }).first().click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.getByRole("link", { name: "Ordens" }).first().click();
  await expect(page.getByRole("heading", { name: "Ordens de serviço" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("Menu principal")).toBeVisible();
  await expect(page.getByLabel("Ritmeia — ir para o início")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
