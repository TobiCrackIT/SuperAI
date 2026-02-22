import { expect, test } from "@playwright/test";

test("homepage renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Ask multiple AI models the same question at once",
    }),
  ).toBeVisible();
});
