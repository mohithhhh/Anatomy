import { expect, type Page } from "@playwright/test";

/** Open the app and wait until every model chunk has loaded. */
export async function openAtlas(page: Page, hash = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/${hash}`);
  await expect(page.getByRole("status", { name: "Loading anatomy" })).toBeHidden({
    timeout: 100_000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  return errors;
}

export function hashOf(page: Page) {
  return new URL(page.url()).hash;
}

export async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not visible`);
  return b;
}

export function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
