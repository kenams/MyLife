import { test, expect } from "@playwright/test";

import { readQaCredentials } from "../lib/qa-account";
import {
  attachConsoleGuard,
  assertNoRuntimeErrors,
  assertNoHorizontalOverflow,
  gotoSignIn,
  loginWithSupabase,
  requireDebug,
} from "./_helpers";

const qa = readQaCredentials();

test.describe("auth mobile", () => {
  test("l'écran de connexion est utilisable en viewport étroit (champs + CTA joignables)", async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await gotoSignIn(page);

    await assertNoHorizontalOverflow(page);

    // champ identifiant : focus + saisie
    const first = page.locator("input").first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    await first.fill("qa@example.test");

    // police ≥ 16px sur web (pas de zoom iOS au focus)
    const fontSize = await first.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize, "police < 16px → zoom iOS au focus").toBeGreaterThanOrEqual(16);

    // le CTA est joignable (scroll autorisé) et cliquable
    const cta = page.getByText(/ENTRER DANS LA VILLE/i).first();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.y, "CTA jamais atteignable").toBeLessThanOrEqual(vp.height);
    expect(box!.y).toBeGreaterThanOrEqual(0);

    assertNoRuntimeErrors(guard);
    guard.dispose();
  });

  test.describe("compte QA Supabase", () => {
    test.skip(!qa, "E2E_QA_EMAIL / E2E_QA_PASSWORD non fournis");

    test("connexion réelle + session persistée après reload", async ({ page }) => {
      const guard = attachConsoleGuard(page);
      await loginWithSupabase(page, qa!.email, qa!.password);

      const before = await requireDebug(page);
      expect(before.player, "profil joueur absent après login").not.toBeNull();
      expect(before.player!.hasSupabaseSession, "session Supabase non établie").toBe(true);

      // reload → toujours connecté, mêmes stats
      await page.reload();
      await page.waitForTimeout(6000);
      const after = await requireDebug(page);
      expect(after.player!.hasSupabaseSession, "session perdue au reload").toBe(true);
      expect(after.player!.username).toBe(before.player!.username);
      expect(after.player!.level).toBe(before.player!.level);
      expect(after.player!.wory).toBe(before.player!.wory);

      assertNoRuntimeErrors(guard);
      guard.dispose();
    });
  });
});
