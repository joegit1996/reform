import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin authentication", () => {
  test("signs in and loads focus management", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.");

    await page.goto("/");

    const emailInput = page.getByLabel("Email");
    const signInButton = page.getByRole("button", { name: "Sign In" });
    let needsSignIn = false;
    try {
      await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible({ timeout: 5000 });
      needsSignIn = true;
    } catch {
      needsSignIn = false;
    }

    if (needsSignIn) {
      await emailInput.fill(adminEmail!);
      await page.getByLabel("Password").fill(adminPassword!);
      await signInButton.click();
      await expect(emailInput).not.toBeVisible({ timeout: 20000 });
    }

    await expect(page.getByRole("heading", { name: "Reform Admin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Focus" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Existing Focuses" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible({ timeout: 20000 });
  });
});
