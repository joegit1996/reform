import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function signInIfNeeded(page: import("@playwright/test").Page) {
  await page.goto("/");
  let needsSignIn = false;
  try {
    await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible({ timeout: 5000 });
    needsSignIn = true;
  } catch {
    needsSignIn = false;
  }
  if (!needsSignIn) return;

  await page.getByLabel("Email").fill(adminEmail!);
  await page.getByLabel("Password").fill(adminPassword!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByLabel("Email")).not.toBeVisible({ timeout: 20000 });
}

test.describe("multi-focus and scoped documents", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.");
    await signInIfNeeded(page);
    await expect(page.getByRole("heading", { name: "Reform Admin" })).toBeVisible();
  });

  test("can switch Plan Builder focus", async ({ page }) => {
    const planFocusSelect = page.locator("#plan-focus");
    const options = planFocusSelect.locator("option");
    const optionCount = await options.count();
    if (optionCount < 2) {
      test.skip(true, "Need at least two active focuses to test switching.");
      return;
    }

    const initialValue = await planFocusSelect.inputValue();
    const secondValue = await options.nth(1).getAttribute("value");
    expect(secondValue).toBeTruthy();
    await planFocusSelect.selectOption(secondValue!);
    await expect(planFocusSelect).toHaveValue(/.+/);
    await expect(planFocusSelect).not.toHaveValue(initialValue);
  });

  test("supports scoped document filtering and selection UX", async ({ page }) => {
    const docsHeading = page.getByRole("heading", { name: "Documents" });
    await docsHeading.scrollIntoViewIfNeeded();
    await expect(docsHeading).toBeVisible();

    const rows = page.locator(".docs-table tbody tr");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip(true, "No document rows available in this environment.");
      return;
    }

    const firstTds = rows.first().locator("td");
    if ((await firstTds.count()) < 5) {
      test.skip(true, "No standard document rows available in this environment.");
      return;
    }

    const firstScopeCell = firstTds.nth(4);
    const scopeText = (await firstScopeCell.textContent())?.trim().toLowerCase();
    if (!scopeText || (scopeText !== "focus" && scopeText !== "global")) {
      test.skip(true, "Could not determine scope value from first row.");
      return;
    }

    await page.locator("#docs-filter-scope").selectOption(scopeText);
    const filteredRows = page.locator(".docs-table tbody tr");
    const filteredCount = await filteredRows.count();
    for (let i = 0; i < filteredCount; i += 1) {
      await expect(filteredRows.nth(i).locator("td").nth(4)).toHaveText(new RegExp(`^${scopeText}$`, "i"));
    }

    const rowCheckboxes = page.locator('.docs-table tbody tr td input[type="checkbox"]:not([disabled])');
    if ((await rowCheckboxes.count()) > 0) {
      await rowCheckboxes.first().check();
      await expect(page.getByText("1 selected")).toBeVisible();
      await page.getByRole("button", { name: "Clear" }).click();
      await expect(page.getByText("0 selected")).toBeVisible();
    }
  });
});
