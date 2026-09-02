import { test, expect } from "@playwright/test";

import { attachConsoleGuard, assertNoRuntimeErrors, enterApp, assertNoHorizontalOverflow, requireDebug, gotoTab } from "./_helpers";

test.describe("smoke", () => {
  test("l'app démarre, la Map charge, la ville est peuplée", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    await expect(page.locator("canvas").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const debug = await requireDebug(page);
    expect(debug.materialized, "ville quasi vide").toBeGreaterThan(60);
    expect(debug.realCount, "des faux joueurs réels sont affichés").toBeLessThan(5);

    await testInfo.attach("map", { body: await page.screenshot(), contentType: "image/png" });
    assertNoRuntimeErrors(guard);
    guard.dispose();
  });

  test("la bottom-nav est cliquable et n'est pas recouverte", async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    for (const label of [/Objectifs/i, /Profil/i, /Map/i]) {
      await gotoTab(page, label);
      await assertNoHorizontalOverflow(page);
    }
    assertNoRuntimeErrors(guard);
    guard.dispose();
  });

  test("un PNJ sollicite réellement le joueur puis ouvre la conversation", async ({ page }, testInfo) => {
    test.setTimeout(100_000);
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    const card = page.getByTestId("npc-social-card");
    await expect(card, "aucune sollicitation PNJ visible dans le délai produit").toBeVisible({ timeout: 70_000 });
    await testInfo.attach("npc-social-card", { body: await page.screenshot(), contentType: "image/png" });

    const respond = page.getByRole("button", { name: /Répondre à/i }).first();
    await expect(respond).toBeVisible();
    await respond.click();
    await page.waitForURL(/\/dm/, { timeout: 15_000 });

    assertNoRuntimeErrors(guard);
    guard.dispose();
  });
});
