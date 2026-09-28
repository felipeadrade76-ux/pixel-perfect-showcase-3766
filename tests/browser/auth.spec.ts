import { expect, test } from "@playwright/test";

test("anonymous access redirects to login and invalid password shows a safe error", async ({
  page,
}) => {
  await page.route("https://example.supabase.co/**", async (route) => {
    if (route.request().url().includes("/auth/v1/token")) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: "invalid_credentials", msg: "Invalid login credentials" }),
      });
    } else {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    }
  });

  await page.goto("/ordens");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("heading", { name: "Ritmeia" })).toBeVisible();

  await page.locator('input[type="email"]').fill("invalido@example.com");
  await page.locator('input[type="password"]').fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha incorretos.");
});

test("the login page fits a phone-sized Chromium viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflowing).toBe(false);
});

test("Ritmeia stays light even when the device prefers dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Ritmeia" })).toBeVisible();
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(scheme).toContain("light");
  expect(background).not.toBe("rgb(0, 0, 0)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
