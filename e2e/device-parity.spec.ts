import { test, expect, chromium, devices } from "@playwright/test";

import { readQaCredentials } from "../lib/qa-account";
import { loginWithSupabase, requireDebug, gotoTab, assertNoHorizontalOverflow } from "./_helpers";

const qa = readQaCredentials();

/**
 * ONE ACCOUNT / ONE WORLD : le même compte QA Supabase ouvert sur desktop ET
 * sur Pixel 5 doit exposer le MÊME profil (username, level, XP, Wory, crew).
 * Les features principales doivent être atteignables sur les deux.
 */
test.describe("parité desktop / mobile", () => {
  test.skip(!qa, "E2E_QA_EMAIL / E2E_QA_PASSWORD non fournis");
  test.setTimeout(180_000);

  test("même compte, même monde sur desktop et Pixel 5", async ({ baseURL }) => {
    const browser = await chromium.launch();
    const desktop = await browser.newContext({ ...devices["Desktop Chrome"], baseURL });
    const mobile = await browser.newContext({ ...devices["Pixel 5"], baseURL });

    const dPage = await desktop.newPage();
    const mPage = await mobile.newPage();

    await loginWithSupabase(dPage, qa!.email, qa!.password);
    await loginWithSupabase(mPage, qa!.email, qa!.password);

    const d = (await requireDebug(dPage)).player!;
    const m = (await requireDebug(mPage)).player!;

    expect(m.username).toBe(d.username);
    expect(m.level).toBe(d.level);
    expect(m.xp).toBe(d.xp);
    expect(m.wory).toBe(d.wory);
    expect(m.crewTag).toBe(d.crewTag);
    expect(m.hasSupabaseSession && d.hasSupabaseSession).toBe(true);

    // features principales atteignables sur mobile
    for (const label of [/Objectifs/i, /Profil/i, /Chat/i, /Map/i]) {
      await gotoTab(mPage, label);
      await assertNoHorizontalOverflow(mPage);
    }

    await browser.close();
  });
});
