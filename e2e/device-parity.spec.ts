import { test, expect, chromium, devices, type Page } from "@playwright/test";

import { readQaCredentials } from "../lib/qa-account";
import {
  assertNoHorizontalOverflow,
  gotoTab,
  loginWithSupabase,
  readDebug,
  requireDebug,
  waitForMap,
} from "./_helpers";

const qa = readQaCredentials();

async function waitForPlayer(page: Page, predicate: (player: NonNullable<Awaited<ReturnType<typeof readDebug>>["player"]>) => boolean) {
  await expect.poll(async () => {
    const player = (await readDebug(page))?.player;
    return player ? predicate(player) : false;
  }, { timeout: 30_000 }).toBe(true);
  return (await requireDebug(page)).player!;
}

test.describe("parite cross-device reelle", () => {
  test.skip(!qa, "E2E_QA_EMAIL / E2E_QA_PASSWORD non fournis");
  test.setTimeout(240_000);

  test("desktop -> Pixel 5 -> desktop conserve progression, Wory et preferences", async ({ baseURL }) => {
    const browser = await chromium.launch();
    const desktop = await browser.newContext({ ...devices["Desktop Chrome"], baseURL });
    const mobile = await browser.newContext({ ...devices["Pixel 5"], baseURL });

    try {
      const dPage = await desktop.newPage();
      await loginWithSupabase(dPage, qa!.email, qa!.password);
      const initial = (await requireDebug(dPage)).player!;
      expect(initial.isQa).toBe(true);
      expect(initial.level).toBeGreaterThanOrEqual(8);

      // Mutation gameplay desktop: vraie action du store, avec XP et Wory.
      await dPage.goto("/home");
      const meal = dPage.getByTestId("life-action-healthy-meal");
      await meal.scrollIntoViewIfNeeded();
      await meal.click();
      await dPage.waitForTimeout(2_500);
      await waitForMap(dPage);
      const afterDesktop = await waitForPlayer(
        dPage,
        (player) => player.xp > initial.xp && player.wory < initial.wory
      );

      // Le second contexte est independant et se connecte apres la persistence desktop.
      const mPage = await mobile.newPage();
      await loginWithSupabase(mPage, qa!.email, qa!.password);
      const onMobile = await waitForPlayer(
        mPage,
        (player) => player.xp === afterDesktop.xp && player.wory === afterDesktop.wory
      );
      expect(onMobile.username).toBe(afterDesktop.username);
      expect(onMobile.level).toBe(afterDesktop.level);

      // Preference + notification lue sur mobile.
      await gotoTab(mPage, /Profil/i);
      await mPage.getByText(/^Clean Life$/i).click();
      await gotoTab(mPage, /Objectifs/i);
      if (onMobile.unreadNotifications > 0) {
        await mPage.getByTestId("mark-all-read").click();
      }
      await mPage.waitForTimeout(2_500);

      // Deuxieme mutation gameplay depuis le Pixel 5.
      await mPage.goto("/home");
      const mobileAction = mPage.getByTestId("life-action-healthy-meal");
      await mobileAction.scrollIntoViewIfNeeded();
      await mobileAction.click();
      await mPage.waitForTimeout(2_500);
      await waitForMap(mPage);
      const afterMobile = await waitForPlayer(
        mPage,
        (player) => player.xp > afterDesktop.xp
          && player.theme === "clean-life"
          && !player.unreadNotificationIds.includes("qa-device-parity-notification")
      );
      await assertNoHorizontalOverflow(mPage);

      // Retour PC: reload propre, puis lecture de l'etat canonique serveur.
      await dPage.reload();
      await waitForMap(dPage);
      const backOnDesktop = await waitForPlayer(
        dPage,
        (player) => player.xp === afterMobile.xp
          && player.wory === afterMobile.wory
          && player.theme === "clean-life"
          && !player.unreadNotificationIds.includes("qa-device-parity-notification")
      );
      expect(backOnDesktop.level).toBe(afterMobile.level);
      expect(backOnDesktop.username).toBe(afterMobile.username);
    } finally {
      await desktop.close();
      await mobile.close();
      await browser.close();
    }
  });
});
