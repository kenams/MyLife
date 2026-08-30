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

const narrow = (width: number, height: number) => ({
  ...devices["Pixel 5"],
  viewport: { width, height },
  screen: { width, height },
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
    { name: "pixel5", use: { ...devices["Pixel 5"] } },
    { name: "pixel7", use: { ...devices["Pixel 5"], viewport: { width: 412, height: 915 }, screen: { width: 412, height: 915 } } },
    { name: "galaxy-s9", use: { ...devices["Galaxy S9+"] } },
    { name: "narrow-320", use: narrow(320, 720) },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
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
