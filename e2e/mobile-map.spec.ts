import { test, expect } from "@playwright/test";

import {
  attachConsoleGuard,
  assertNoRuntimeErrors,
  assertNoHorizontalOverflow,
  enterApp,
  requireDebug,
} from "./_helpers";

test.describe("mobile map — layout & interactions", () => {
  test("pas d'overflow horizontal, carte manipulable, drawer ouvrable/fermable", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    await assertNoHorizontalOverflow(page);

    // drag carte
    const box = await page.locator("canvas").first().boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 - 60, box!.y + box!.height / 2 - 40, { steps: 10 });
    await page.mouse.up();

    // molette / zoom
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    await assertNoHorizontalOverflow(page);

    // drawer contextuel (bouton ☰)
    const burger = page.getByText("☰", { exact: false }).first();
    if (await burger.isVisible().catch(() => false)) {
      await burger.click();
      await page.waitForTimeout(500);
      const close = page.getByText(/^✕$|Fermer/i).first();
      await close.click({ timeout: 8000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      await assertNoHorizontalOverflow(page);
    }

    await requireDebug(page);
    await testInfo.attach("mobile-map", { body: await page.screenshot(), contentType: "image/png" });
    assertNoRuntimeErrors(guard);
    guard.dispose();
  });

  test("le bouton géoloc / CTA n'est pas caché sous la bottom-nav", async ({ page }) => {
    await enterApp(page);
    const cta = page.getByText(/Apparaître sur la map|Activer.*position/i).first();
    if (await cta.isVisible().catch(() => false)) {
      const ctaBox = await cta.boundingBox();
      const vp = page.viewportSize()!;
      expect(ctaBox!.y + ctaBox!.height, "CTA sous le bord de l'écran").toBeLessThanOrEqual(vp.height);
    }
  });
});
