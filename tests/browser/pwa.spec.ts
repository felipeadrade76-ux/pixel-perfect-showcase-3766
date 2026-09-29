import { expect, test } from "@playwright/test";

test("Ritmeia exposes an installable PWA shell without caching authenticated pages", async ({
  page,
  request,
}) => {
  await page.goto("/login");

  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("Ritmeia");
  expect(manifest.display).toBe("standalone");

  const swResponse = await request.get("/sw.js");
  expect(swResponse.ok()).toBe(true);
  const sw = await swResponse.text();
  expect(sw).toContain('/ritmeia-mark.svg');
  expect(sw).not.toContain("/ordens");
  expect(sw).not.toContain("/clientes");
  expect(sw).not.toContain("/financeiro");
});
