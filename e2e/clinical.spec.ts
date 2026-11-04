import { expect, test } from "@playwright/test";
import { openAtlas } from "./helpers";

test("a muscle shows its card and opens the nerve lesion view", async ({ page }) => {
  await openAtlas(page, "#p=FJ1478M");
  await expect(page.getByText("Draft · pending review")).toBeVisible();
  await expect(page.getByText(/Source: Uberon UBERON:/)).toBeVisible();
  await page.getByRole("button", { name: "Musculocutaneous nerve" }).click();
  await expect(page.getByText("Muscles affected (3), shown in red")).toBeVisible();
  await page.getByLabel("Nerve", { exact: true }).selectOption("radial");
  await expect(page.getByText(/Wrist drop/)).toBeVisible();
});

test("the cross-section slicer cuts and can be removed", async ({ page }) => {
  const errors = await openAtlas(page);
  await page.getByRole("button", { name: "Cross-section" }).click();
  await page.getByRole("button", { name: "Sagittal" }).click();
  await page.locator("#slice-position").fill("50");
  await expect(page.getByRole("button", { name: "Remove cross-section" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Remove cross-section" }).click();
  await expect(page.locator("#slice-position")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a practical exam runs ten stations and shows the score", async ({ page }) => {
  test.slow(); // long flow; software WebGL in CI is slow
  await openAtlas(page, "#study=1&n=Arm%20bones&r=upper_limb&s=skeletal&t=name");
  await page.getByRole("button", { name: "Exam" }).click();
  const exam = page.locator("section[aria-label='Practical exam']");
  await expect(exam).toContainText("Station 1 / 10");
  for (let i = 0; i < 10; i++) await exam.getByRole("button", { name: "Next" }).click();
  await expect(exam.getByRole("heading", { name: /Score \d+ \/ 10/ })).toBeVisible();
  await exam.getByRole("button", { name: "Review my misses" }).click();
  await expect(page.locator("section[aria-label=Quiz]")).toContainText("Exam misses");
});
