import { test, expect } from "@playwright/test";

test.describe("mobile web installability", () => {
  test("serves a manifest and phone-first metadata", async ({ page, request, baseURL }) => {
    expect(baseURL).toBeTruthy();

    await page.goto("/map");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#07111f");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");

    const response = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("MyLife");
    expect(manifest.start_url).toBe("/map");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons?.[0]?.src).toBe("/mylife-icon.svg");

    const icon = await request.get(`${baseURL}/mylife-icon.svg`);
    expect(icon.ok()).toBe(true);
    expect(icon.headers()["content-type"] ?? "").toContain("image/svg+xml");
  });
});
