import { expect, test } from "@playwright/test";
import { box, hashOf, openAtlas, overlaps } from "./helpers";

test("loads the full model without errors", async ({ page }) => {
  const errors = await openAtlas(page);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("2,234 pieces · BodyParts3D")).toBeVisible();
  await expect(page.getByText(/2,229 pieces visible/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("search selects a structure and the link reopens it", async ({ page }) => {
  await openAtlas(page);
  await page.keyboard.press("/");
  await page.getByRole("combobox", { name: "Search named structures" }).fill("left kidney");
  await page.keyboard.press("Enter");
  await expect(page.locator("#detail-title")).toHaveText("Left kidney");
  await expect.poll(() => hashOf(page)).toContain("c=FMA7205");

  const link = page.url();
  await page.goto("about:blank");
  await page.goto(link);
  await expect(page.getByRole("status", { name: "Loading anatomy" })).toBeHidden({
    timeout: 100_000,
  });
  await expect(page.locator("#detail-title")).toHaveText("Left kidney");
});

test("system switches and presets update the view and the URL", async ({ page }) => {
  await openAtlas(page);
  await page.getByRole("button", { name: "Skeleton", exact: true }).first().click();
  await expect(page.getByText("294 pieces visible")).toBeVisible();
  await expect.poll(() => hashOf(page)).toBe("#sys=skeletal");

  await page.getByRole("switch", { name: "Show muscles" }).click();
  await expect(page.getByText("698 pieces visible")).toBeVisible();
  await expect.poll(() => hashOf(page)).toBe("#sys=skeletal,muscular");

  await page.getByRole("button", { name: "Hide all" }).click();
  await expect.poll(() => hashOf(page)).toBe("#sys=none");
});

test("tapping the body selects the structure under the pointer", async ({ page }) => {
  await openAtlas(page, "#v=front");
  const canvas = await box(page, "canvas");
  // Upper chest, front view.
  await page.mouse.click(canvas.x + canvas.width / 2 + 30, canvas.y + canvas.height * 0.3);
  await expect(page.locator("#detail-title")).not.toBeEmpty();
  await expect.poll(() => hashOf(page)).toMatch(/p=FJ\d+/);
});

test("an isolate link opens isolated, and toggles back", async ({ page }) => {
  await openAtlas(page, "#c=FMA7088&iso=1");
  await expect(page.locator("#detail-title")).toHaveText("Heart");
  const toggle = page.getByRole("button", { name: "Show surroundings" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("83 pieces visible")).toBeVisible();
  await toggle.click();
  await expect.poll(() => hashOf(page)).toBe("#c=FMA7088");
});

test("unknown structures in a link are ignored", async ({ page }) => {
  const errors = await openAtlas(page, "#c=FMA99999999&sys=skeletal");
  await expect(page.locator("#detail-title")).toHaveCount(0);
  await expect.poll(() => hashOf(page)).toBe("#sys=skeletal");
  expect(errors).toEqual([]);
});

test("explode moves to the inventory and reset restores the default", async ({ page }) => {
  await openAtlas(page, "#sys=skeletal");
  await page.locator("#explode").fill("100");
  await expect.poll(() => hashOf(page)).toContain("x=100");
  await expect(page.getByRole("button", { name: "Side view" })).toBeDisabled();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect.poll(() => hashOf(page)).toBe("");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`layout fits at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openAtlas(page, "#c=FMA7088");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width);

    const header = await box(page, "header > div");
    const detail = await box(page, "section[aria-labelledby=detail-title]");
    expect(overlaps(header, detail)).toBe(false);
    expect(detail.y + detail.height).toBeLessThanOrEqual(viewport.height);
    expect(detail.x + detail.width).toBeLessThanOrEqual(viewport.width);

    await page.getByRole("button", { name: "Close" }).click();
    const dock = await box(page, "#explode");
    expect(overlaps(header, dock)).toBe(false);
    expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height);
  });
}
