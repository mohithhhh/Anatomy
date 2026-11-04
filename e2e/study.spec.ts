import { expect, test, type Page } from "@playwright/test";
import { box, openAtlas, overlaps } from "./helpers";

const quiz = (page: Page) => page.locator("section[aria-label=Quiz]");

/** Answer the current question with any option (or "Show me"), then continue. */
async function answerAny(page: Page) {
  const options = quiz(page).getByRole("group").getByRole("button");
  if ((await options.count()) > 0) await options.first().click();
  else await quiz(page).getByRole("button", { name: "Show me" }).click();
  await expect(quiz(page).getByRole("status")).toBeVisible();
  await quiz(page).getByRole("button", { name: "Next" }).click();
}

test("a starter deck session records progress that survives a reload", async ({ page }) => {
  const errors = await openAtlas(page);
  await page.getByRole("button", { name: /^Study/ }).click();
  await page.getByRole("button", { name: /Upper limb: bones/ }).click();
  await expect(page.locator("#quiz-prompt")).toBeVisible();
  await expect(quiz(page)).toContainText("Upper limb: bones · 1 /");

  for (let i = 0; i < 3; i++) await answerAny(page);
  await expect(quiz(page)).toContainText("· 4 /");

  await quiz(page).getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("dialog", { name: "Upper limb: bones" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#study-title")).toHaveText("Study");
  await expect(page.getByText("Your decks")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("status", { name: "Loading anatomy" })).toBeHidden({
    timeout: 100_000,
  });
  await page.getByRole("button", { name: /^Study/ }).click();
  const reviewed = page.getByText("Reviewed today").locator("..");
  await expect(reviewed).toContainText("3");
  await expect(page.getByText(/3\/\d+ seen/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the deck builder creates a deck and starts it", async ({ page }) => {
  await openAtlas(page);
  await page.getByRole("button", { name: /^Study/ }).click();
  await page.getByRole("button", { name: "New deck" }).click();
  await page.getByRole("button", { name: "Upper limb", exact: true }).click(); // deselect
  await page.getByRole("button", { name: "Lower limb", exact: true }).click();
  await expect(page.getByText(/structures · \d+ cards/)).toBeVisible();
  await page.getByLabel("Name").fill("Leg bones");
  await page.getByRole("button", { name: "Create and start" }).click();
  await expect(quiz(page)).toContainText("Leg bones · 1 /");
});

test("a shared deck link adds the deck", async ({ page }) => {
  await openAtlas(page, "#study=1&n=Shared%20skull&r=head_neck&s=skeletal&t=name");
  await expect(page.locator("#study-title")).toHaveText("Study");
  await expect(page.getByText("Shared skull")).toBeVisible();
});

test("quiz me on this starts a short session about the selection", async ({ page }) => {
  await openAtlas(page, "#p=FJ1478M");
  await page.getByRole("button", { name: "Quiz me on this" }).click();
  await expect(quiz(page)).toContainText("Quick quiz · 1 /");
  await answerAny(page);
  await expect(quiz(page)).toContainText("Quick quiz · 2 /");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`quiz fits at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openAtlas(page);
    await page.getByRole("button", { name: /Study/ }).click();
    await page.getByRole("button", { name: /Thorax: the heart/ }).click();
    await expect(page.locator("#quiz-prompt")).toBeVisible();
    const header = await box(page, "header > div");
    const panel = await box(page, "section[aria-label=Quiz]");
    expect(overlaps(header, panel)).toBe(false);
    expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
  });
}
