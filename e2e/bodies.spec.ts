import { expect, test } from "@playwright/test";
import { hashOf, openAtlas } from "./helpers";

test("switching to the female body loads it and keeps it in the link", async ({ page }) => {
  const errors = await openAtlas(page);
  await page.getByRole("radio", { name: "Female", exact: true }).click();
  await expect(page.getByText("888 pieces · HuBMAP HRA")).toBeVisible({ timeout: 100_000 });
  await expect(page.getByRole("status", { name: "Loading anatomy" })).toBeHidden({
    timeout: 100_000,
  });
  await expect.poll(() => hashOf(page)).toBe("#b=f");

  await page.keyboard.press("/");
  await page.getByRole("combobox", { name: "Search named structures" }).fill("kidney");
  await page.keyboard.press("Enter");
  await expect(page.locator("#detail-title")).toHaveText("Kidney");
  await expect.poll(() => hashOf(page)).toContain("c=HRA:VH_F_kidney");

  await page.reload();
  await expect(page.getByRole("status", { name: "Loading anatomy" })).toBeHidden({
    timeout: 100_000,
  });
  await expect(page.locator("#detail-title")).toHaveText("Kidney");
  await expect(page.getByRole("radio", { name: "Female", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await expect(page.getByText("2,234 pieces · BodyParts3D")).toBeVisible({ timeout: 100_000 });
  expect(errors).toEqual([]);
});
