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
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(saved ? [saved] : []),
        });
      }
    } else if (url.pathname === "/rest/v1/cobrancas") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
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
});
