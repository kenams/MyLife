import { test, expect } from "@playwright/test";

import {
  attachConsoleGuard,
  assertNoRuntimeErrors,
  enterApp,
  requireDebug,
  readDebug,
  movedCount,
  type DebugSnapshot,
} from "./_helpers";

/**
 * TEST D'ACCEPTATION : on pose le téléphone, on ne touche plus rien.
 * La ville doit continuer de vivre — des habitants bougent, changent
 * d'activité, des trajets existent, City Pulse évolue, aucun crash.
 */
// Durée de la fenêtre d'observation : 180 s par défaut (PR), 300 s en démo
// finale (`E2E_IDLE_SECONDS=300`).
const IDLE_SECONDS = Number(process.env.E2E_IDLE_SECONDS ?? 180);

test.describe("idle demo — la ville vit sans le joueur", () => {
  test.setTimeout((IDLE_SECONDS + 120) * 1000);

  test(`après ~${Math.round(IDLE_SECONDS / 60)} min sans interaction, le monde a changé`, async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await enterApp(page);

    const t0 = await requireDebug(page);
    await testInfo.attach("t0", { body: await page.screenshot(), contentType: "image/png" });

    const samples: DebugSnapshot[] = [t0];
    const stepMs = 28_000;
    const steps = Math.max(4, Math.round((IDLE_SECONDS * 1000) / stepMs));
    for (let i = 0; i < steps; i++) {
      await page.waitForTimeout(stepMs);
      const snap = await readDebug(page);
      if (snap) samples.push(snap);
    }
    const tN = samples[samples.length - 1];
    await testInfo.attach("tN", { body: await page.screenshot(), contentType: "image/png" });

    // population maintenue
    expect(tN.materialized, "la ville s'est vidée").toBeGreaterThan(60);

    // au moins un snapshot montre du mouvement réel vs t0
    const maxMoved = Math.max(...samples.slice(1).map((s) => movedCount(t0, s)));
    expect(maxMoved, "aucun habitant n'a bougé").toBeGreaterThanOrEqual(5);

    // des habitants sont en trajet à un moment donné
    const maxTraveling = Math.max(...samples.map((s) => s.travelingCount));
    expect(maxTraveling, "personne ne se déplace en ville").toBeGreaterThanOrEqual(1);

    // les activités varient (pas 200 clones)
    const activitySpread = Math.max(...samples.map((s) => Object.keys(s.activityHistogram).length));
    expect(activitySpread, "une seule activité pour toute la ville").toBeGreaterThan(3);

    // la simulation a avancé (tick monotone) OU au minimum re-projeté
    expect(tN.updatedAt, "le runtime ne publie plus").toBeGreaterThan(t0.updatedAt);
    expect(tN.tick, "aucun tick de simulation").toBeGreaterThanOrEqual(t0.tick);

    // pas de rechargement complet de page
    expect(page.url()).toContain("/map");

    // carte toujours interactive
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(260, 340, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator("canvas").first()).toBeVisible();

    assertNoRuntimeErrors(guard);
    guard.dispose();

    testInfo.attach(
      "resume",
      {
        body: Buffer.from(
          JSON.stringify(
            {
              samples: samples.length,
              materialized_t0: t0.materialized,
              materialized_tN: tN.materialized,
              maxMoved,
              maxTraveling,
              activitySpread,
              tick_t0: t0.tick,
              tick_tN: tN.tick,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      },
    );
  });
});
