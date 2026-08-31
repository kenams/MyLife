import { test, expect } from "@playwright/test";

import { readQaCredentials } from "../lib/qa-account";
import {
  attachConsoleGuard,
  assertNoRuntimeErrors,
  assertNoHorizontalOverflow,
  gotoSignIn,
  gotoTab,
  loginWithSupabase,
  requireDebug,
} from "./_helpers";

const qa = readQaCredentials();

async function mutateStoredSession(page: import("@playwright/test").Page, invalidateRefresh = false) {
  await page.evaluate((invalidate) => {
    const raw = localStorage.getItem("mylife-auth");
    if (!raw) throw new Error("session Supabase absente du localStorage");
    const value = JSON.parse(raw);
    value.expires_at = 1;
    if (invalidate) value.refresh_token = "invalid-refresh-token";
    localStorage.setItem("mylife-auth", JSON.stringify(value));
  }, invalidateRefresh);
}

test.describe("auth responsive", () => {
  test("l'ecran de connexion reste utilisable en viewport etroit", async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await gotoSignIn(page);
    await assertNoHorizontalOverflow(page);

    const first = page.locator("input").first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    await first.fill("qa@example.test");
    const fontSize = await first.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize, "police < 16px: zoom iOS au focus").toBeGreaterThanOrEqual(16);

    const cta = page.getByText(/ENTRER DANS LA VILLE/i).first();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y, "CTA jamais atteignable").toBeLessThanOrEqual(viewport.height);
    expect(box!.y).toBeGreaterThanOrEqual(0);

    assertNoRuntimeErrors(guard);
    guard.dispose();
  });

  test.describe("compte QA Supabase", () => {
    test.skip(!qa, "E2E_QA_EMAIL / E2E_QA_PASSWORD non fournis");

    test("login, reload, refresh token, logout et reconnexion", async ({ page }) => {
      const guard = attachConsoleGuard(page);
      await loginWithSupabase(page, qa!.email, qa!.password);

      const before = await requireDebug(page);
      expect(before.player, "profil joueur absent apres login").not.toBeNull();
      expect(before.player!.hasSupabaseSession).toBe(true);

      await page.reload();
      await page.waitForTimeout(6000);
      const after = await requireDebug(page);
      expect(after.player!.hasSupabaseSession, "session perdue au reload").toBe(true);
      expect(after.player!.username).toBe(before.player!.username);
      expect(after.player!.level).toBe(before.player!.level);
      expect(after.player!.wory).toBe(before.player!.wory);

      await mutateStoredSession(page);
      await page.reload();
      await page.waitForTimeout(6000);
      expect((await requireDebug(page)).player!.hasSupabaseSession, "refresh token non recupere").toBe(true);

      await gotoTab(page, /Profil/i);
      await page.getByText(/connexion/i).filter({ hasText: /D.connexion/i }).click();
      await page.waitForURL(/sign-in/, { timeout: 15_000 });
      await loginWithSupabase(page, qa!.email, qa!.password);
      expect((await requireDebug(page)).player!.hasSupabaseSession, "reconnexion apres logout impossible").toBe(true);

      assertNoRuntimeErrors(guard);
      guard.dispose();
    });

    test("mauvais mot de passe et session invalide", async ({ page }) => {
      await gotoSignIn(page);
      await page.getByText(/^CONNEXION$/).first().click({ timeout: 8000 }).catch(() => undefined);
      await page.locator("input").first().fill(qa!.email);
      await page.locator('input[type="password"]').first().fill(`${qa!.password}-incorrect`);
      await page.getByText(/ENTRER DANS LA VILLE/i).first().click();
      await expect(page.getByText(/invalid|incorrect|identifiants|connexion impossible/i).first()).toBeVisible();

      await loginWithSupabase(page, qa!.email, qa!.password);
      await mutateStoredSession(page, true);
      await page.reload();
      await page.waitForURL(/sign-in/, { timeout: 20_000 });
      await expect(page.getByText(/ENTRER DANS LA VILLE/i).first()).toBeVisible();
    });
  });
});
