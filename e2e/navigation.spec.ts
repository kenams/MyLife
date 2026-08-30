import { test, expect } from "@playwright/test";

import { attachConsoleGuard, assertNoRuntimeErrors, enterApp, assertNoHorizontalOverflow, gotoTab } from "./_helpers";

const TABS: RegExp[] = [/Map/i, /Chat/i, /Crews/i, /Objectifs/i, /Profil/i];

test.describe("navigation", () => {
  test("chaque onglet répond, aucun loader bloqué, aucune erreur", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    for (const label of TABS) {
      await gotoTab(page, label);
      await page.waitForTimeout(800);
      // pas de spinner permanent : "Chargement..." doit disparaître
      const spinner = page.getByText(/^Chargement\.\.\.$/i).first();
      await expect(spinner).toBeHidden({ timeout: 20_000 }).catch(async () => {
        await testInfo.attach(`stuck-${label.source}`, { body: await page.screenshot(), contentType: "image/png" });
        throw new Error(`spinner bloqué sur ${label}`);
      });
      await assertNoHorizontalOverflow(page);
    }

    // retour Map fonctionne
    await gotoTab(page, /Map/i);
    await expect(page.locator("canvas").first()).toBeVisible();

    assertNoRuntimeErrors(guard);
    guard.dispose();
  });

  test("Territoires ne bloque pas sur un loader infini", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    await gotoTab(page, /Crews/i);
    const territo = page.getByText(/Territoires de Toulouse|Territoires/i).first();
    if (await territo.isVisible().catch(() => false)) {
      await territo.click();
      await page.waitForTimeout(1500);
      const spinner = page.getByText(/^Chargement/i).first();
      await expect(spinner).toBeHidden({ timeout: 20_000 });
      await testInfo.attach("territories", { body: await page.screenshot(), contentType: "image/png" });
    }
    assertNoRuntimeErrors(guard);
    guard.dispose();
  });
});
