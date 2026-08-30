import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — couche mobile-first pour MyLife (Expo web).
 *
 * Cible : Chromium mobile (Android) principalement, plus quelques viewports
 * étroits et un desktop de contrôle. Le serveur web est le bundle Expo dev
 * (hooks QA + __mylifeDebug actifs via __DEV__).
 *
 * Vitest reste la couche unitaire — `npm test` n'est pas touché.
 */

const PORT = Number(process.env.E2E_PORT ?? 8099);
const PROD_URL = process.env.E2E_PROD_URL ?? "https://mylife-app-rho.vercel.app";
const useProd = process.env.E2E_TARGET === "prod";
const baseURL = useProd ? PROD_URL : `http://localhost:${PORT}`;

// Tous les projets tournent sur le moteur Chromium (émulation mobile) : c'est
// la cible demandée et ça évite d'installer WebKit/Firefox en CI.
const chromiumMobile = (width: number, height: number, extra: Record<string, unknown> = {}) => ({
  ...devices["Pixel 5"],
  defaultBrowserType: "chromium" as const,
  viewport: { width, height },
  screen: { width, height },
  ...extra,
});

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "e2e/.artifacts",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },

  projects: [
    { name: "pixel5", use: chromiumMobile(393, 851) },
    { name: "pixel7", use: chromiumMobile(412, 915) },
    { name: "galaxy-s9", use: chromiumMobile(320, 658) },
    { name: "narrow-320", use: chromiumMobile(320, 720) },
    { name: "iphone-13", use: chromiumMobile(390, 844) },
    { name: "iphone-se", use: chromiumMobile(375, 667) },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: useProd
    ? undefined
    : {
        command: `npx expo start --web --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
