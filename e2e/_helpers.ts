import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Garde-fou console : fait échouer un test sur une vraie erreur runtime.
 * On ignore le bruit connu (tuiles carto, favicon, warnings dev tiers).
 */
const IGNORED = [
  /Download the React DevTools/i,
  /\[expo-/i,
  /Failed to load resource/i,
  /favicon/i,
  /net::ERR_/i,
  /openfreemap|tiles?\./i,
  /source map/i,
  /Warning: .*(componentWillReceiveProps|defaultProps|findDOMNode)/i,
];

export type ConsoleGuard = { errors: string[]; dispose: () => void };

export function attachConsoleGuard(page: Page): ConsoleGuard {
  const errors: string[] = [];
  const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  };
  const onPageError = (err: Error) => {
    if (IGNORED.some((re) => re.test(err.message))) return;
    errors.push(`pageerror: ${err.message}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    errors,
    dispose: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

export function assertNoRuntimeErrors(guard: ConsoleGuard) {
  expect(guard.errors, `runtime errors:\n${guard.errors.join("\n")}`).toEqual([]);
}

/** Entre dans l'app via la connexion rapide dev et attend la Map. */
export async function enterApp(page: Page) {
  await page.goto("/");
  // Bandeau âge (dev) → connexion rapide ; sinon on est déjà plus loin.
  const quick = page.getByText(/CONNEXION RAPIDE/i).first();
  const signInQuick = page.getByText(/Connexion rapide/i).first();
  try {
    await quick.waitFor({ state: "visible", timeout: 8000 });
    await quick.click();
  } catch {
    /* déjà passé l'âge */
  }
  // Écran sign-in éventuel
  try {
    await signInQuick.waitFor({ state: "visible", timeout: 4000 });
    await signInQuick.click();
  } catch {
    /* pas d'écran sign-in */
  }
  await page.waitForURL(/\/(map|home)/, { timeout: 30_000 }).catch(() => undefined);
  await waitForMap(page);
}

/**
 * Onglet de la bottom-nav. expo-router web rend chaque onglet en <a href="/xxx">
 * (role=link) contenant le libellé exact. On cible par href pour éviter les
 * faux positifs (ex. lien d'attribution "OpenFreeMap" pour /Map/).
 */
const TAB_HREF: Record<string, string> = {
  Map: "/map", Chat: "/chat", Crews: "/crews", Objectifs: "/notifications", Profil: "/profile",
};

export function tab(page: Page, name: RegExp) {
  const key = Object.keys(TAB_HREF).find((k) => name.test(k)) ?? "Map";
  return page
    .locator(`a[href="${TAB_HREF[key]}"], a[href$="${TAB_HREF[key]}"]`)
    .first()
    .or(page.getByRole("link", { name: new RegExp(`^${key}$`, "i") }).first());
}

export async function gotoTab(page: Page, name: RegExp, expectUrl?: RegExp) {
  const t = tab(page, name);
  await t.scrollIntoViewIfNeeded().catch(() => undefined);
  await t.click({ timeout: 12_000, force: true });
  if (expectUrl) await page.waitForURL(expectUrl, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(700);
}

/** Attend que la carte MapLibre soit montée et interactive. */
export async function waitForMap(page: Page) {
  await page.goto("/map").catch(() => undefined);
  await expect
    .poll(async () => page.evaluate(() => !!document.querySelector(".maplibregl-canvas, canvas")), {
      timeout: 45_000,
      message: "canvas carte jamais monté",
    })
    .toBeTruthy();
  // laisse CityRuntime publier au moins un snapshot
  await page.waitForTimeout(4000);
}

export type DebugSnapshot = {
  updatedAt: number;
  tick: number;
  realCount: number;
  npcCount: number;
  materialized: number;
  eventCount: number;
  travelingCount: number;
  activityHistogram: Record<string, number>;
  positions: { id: string; lat: number; lng: number; act: string }[];
  history: number[];
};

export async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => (window as unknown as { __mylifeDebug?: DebugSnapshot }).__mylifeDebug ?? null);
}

export async function requireDebug(page: Page): Promise<DebugSnapshot> {
  const snap = await readDebug(page);
  expect(snap, "window.__mylifeDebug indisponible (hook QA non chargé)").not.toBeNull();
  return snap!;
}

/** Vérifie l'absence de scroll horizontal du body. */
export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return { scrollW: el.scrollWidth, clientW: el.clientWidth };
  });
  expect(overflow.scrollW, "overflow horizontal du body").toBeLessThanOrEqual(overflow.clientW + 2);
}

export async function screenshotOnStep(page: Page, testInfo: TestInfo, name: string) {
  const buf = await page.screenshot();
  await testInfo.attach(name, { body: buf, contentType: "image/png" });
}

/** Compte de positions PNJ distinctes entre deux snapshots. */
export function movedCount(a: DebugSnapshot, b: DebugSnapshot): number {
  const byId = new Map(a.positions.map((p) => [p.id, p]));
  let moved = 0;
  for (const p of b.positions) {
    const prev = byId.get(p.id);
    if (!prev) continue;
    if (Math.abs(prev.lat - p.lat) > 1e-5 || Math.abs(prev.lng - p.lng) > 1e-5) moved += 1;
  }
  return moved;
}
