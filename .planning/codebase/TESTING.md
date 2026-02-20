# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Frameworks

**Unit/Integration Testing:**
- Framework: Node.js built-in `node:test` module (no Jest/Vitest setup)
- Assertion Library: `node:assert/strict`
- Location: `apps/mobile/src/features/focus/focusScope.test.ts`, `supabase/functions/chat/retrieval.test.ts`
- Run Command: `node --test` (standard Node.js test runner)

**End-to-End Testing:**
- Framework: Playwright Test (`@playwright/test`)
- Config: `apps/admin-web/playwright.config.ts`
- Location: `apps/admin-web/e2e/` directory (`.spec.ts` files)
- Run Commands:
  ```bash
  npm --workspace @reform/admin-web run test:e2e       # Run all e2e tests
  npm --workspace @reform/admin-web run test:e2e:ui    # Run with Playwright UI
  ```

## Test File Organization

**Location Pattern:**
- Unit tests: co-located with source code (same directory as implementation)
- E2E tests: separate `e2e/` directory in app root

**Naming:**
- Unit tests: `.test.ts` suffix (e.g., `focusScope.test.ts`)
- E2E tests: `.spec.ts` suffix (e.g., `admin-auth.spec.ts`)
- Test names: descriptive, human-readable with `test()` or `test.describe()`

**Structure Example:**
```
apps/mobile/src/features/
├── focus/
│   ├── focusScope.ts          # Implementation
│   └── focusScope.test.ts     # Co-located unit tests
└── chat/
    └── ChatScreen.tsx         # Component (no test file yet)
```

## Unit Test Structure (Node:test)

**Basic Pattern:**
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { functionToTest } from "./module";

test("descriptive test name", () => {
  // Arrange
  const input = "test data";

  // Act
  const result = functionToTest(input);

  // Assert
  assert.equal(result, expectedValue);
});

test("another test case", () => {
  assert.deepEqual(result, { key: "value" });
});
```

**Real Example from `focusScope.test.ts`:**
```typescript
test("focus switch updates article scope filter", () => {
  const filterA = buildDocumentScopeFilter("focus-a");
  const filterB = buildDocumentScopeFilter("focus-b");
  assert.equal(filterA, "scope.eq.global,focus_id.eq.focus-a");
  assert.equal(filterB, "scope.eq.global,focus_id.eq.focus-b");
  assert.notEqual(filterA, filterB);
  assert.equal(buildDocumentScopeFilter(null), "scope.eq.global");
});
```

**Assertion Methods Used:**
- `assert.equal()` - Loose equality check
- `assert.notEqual()` - Not equal
- `assert.deepEqual()` - Deep equality for objects/arrays
- `assert.match()` - Regex pattern matching
- `assert.throws()` - Exception testing (if needed)

## E2E Test Structure (Playwright)

**Framework Setup:**
```typescript
import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("feature name", () => {
  test("descriptive test case", async ({ page }) => {
    // Test implementation
  });
});
```

**Real Example from `admin-auth.spec.ts`:**
```typescript
test.describe("admin authentication", () => {
  test("signs in and loads focus management", async ({ page }) => {
    // Skip if env vars not set
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

    // Navigate
    await page.goto("/");

    // Get elements
    const emailInput = page.getByLabel("Email");
    const signInButton = page.getByRole("button", { name: "Sign In" });

    // Check if already signed in
    let needsSignIn = false;
    try {
      await expect(page.getByRole("heading", { name: "Admin Sign In" }))
        .toBeVisible({ timeout: 5000 });
      needsSignIn = true;
    } catch {
      needsSignIn = false;
    }

    // Sign in if needed
    if (needsSignIn) {
      await emailInput.fill(adminEmail!);
      await page.getByLabel("Password").fill(adminPassword!);
      await signInButton.click();
      await expect(emailInput).not.toBeVisible({ timeout: 20000 });
    }

    // Verify loaded content
    await expect(page.getByRole("heading", { name: "Reform Admin" }))
      .toBeVisible();
  });
});
```

**Playwright Patterns:**
- `page.goto()` - Navigate to URL
- `page.getByLabel()` - Find by label text (accessible)
- `page.getByRole()` - Find by ARIA role
- `expect().toBeVisible()` - Assertion with timeout
- `expect().not.toBeVisible()` - Negative assertions
- Configuration: see `playwright.config.ts` for retries, screenshots, video capture
- Environment variables: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_BASE_URL`

## Playwright Configuration

**File:** `apps/admin-web/playwright.config.ts`

**Key Settings:**
```typescript
testDir: "./e2e",                    // Test file location
fullyParallel: true,                // Run tests in parallel
forbidOnly: !!process.env.CI,       // Fail if only() used in CI
retries: process.env.CI ? 2 : 0,   // Retry failed tests in CI
workers: process.env.CI ? 1 : undefined, // Single worker in CI
reporter: "list",                   // Simple output format
trace: "on-first-retry",           // Capture traces on retry
screenshot: "only-on-failure",     // Screenshots only on failure
video: "retain-on-failure",        // Videos only on failure
```

**Web Server:**
```typescript
webServer: {
  command: "npm run dev -- --host 127.0.0.1 --port 5174",
  cwd: ".",
  port: 5174,
  reuseExistingServer: !process.env.CI,
  timeout: 120000
}
```

## Mocking

**Unit Tests (Node:test):**
- No mocking framework detected (using plain functions)
- Tests are pure function tests without external dependencies
- No mock usage in current test files

**E2E Tests (Playwright):**
- No mocking - tests run against real application
- Environment variables for configuration
- Conditional skipping based on setup: `test.skip(condition, "reason")`

**Pattern for Optional Test Skip:**
```typescript
test.skip(
  !adminEmail || !adminPassword,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test."
);
```

## What to Test

**Unit Tests:**
- Pure utility functions (e.g., parsers, formatters, builders)
- Data transformation functions
- Business logic without side effects
- Return value correctness
- Edge cases (null, empty, special values)

**Real Coverage in Codebase:**
- `focusScope.test.ts`: Tests `buildDocumentScopeFilter()`, `buildChatPayload()`, `buildPlanSelection()`
- `retrieval.test.ts`: Tests `mergeHybridChunks()`, `mapFallbackChunks()`, `chooseSelectedChunks()`

**E2E Tests:**
- User workflows (sign in, form submission, navigation)
- Integration between frontend and backend
- Visible UI state and page loads

## Test Data

**Unit Tests:**
- Inline test data (no fixtures file needed)
- Sample data structures created in test bodies
- Type examples: `{ chunk_id: "a", document_id: "d1", ... }`

**E2E Tests:**
- Environment variables: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_BASE_URL`
- Default base URL: `http://127.0.0.1:5174` if `E2E_BASE_URL` not set
- Real backend/database used (no test database)

## Coverage

**Requirements:** Not enforced (no coverage tool configured)

**Observations:**
- Limited test coverage in current codebase
- Unit tests exist only for utility/pure functions
- E2E tests focus on critical user workflows
- Most React components untested
- No integration test structure

**Gaps:**
- React components: `DocumentUpload`, `ChatScreen`, `PlanHomeScreen` have no tests
- Custom hooks: `usePlanWeek`, `useCurrentFocus` untested
- API layer: No mocked/isolated API tests
- Error scenarios: Not comprehensively tested

## Async Testing

**Pattern in Unit Tests:**
- No async unit tests in current suite
- All node:test examples are synchronous

**Pattern in E2E Tests:**
```typescript
test("test name", async ({ page }) => {
  // All Playwright methods are async
  await page.goto("/");
  await expect(element).toBeVisible({ timeout: 5000 });
  await emailInput.fill(email);
  await signInButton.click();
});
```

**Timeouts:**
- E2E: `{ timeout: 5000 }` or `{ timeout: 20000 }` on expect() calls
- Playwright: `timeout: 120000` on webServer startup

## Test Execution

**Commands by Workspace:**

```bash
# Mobile app - Would use node:test for unit tests (if configured)
npm --workspace @reform/mobile run test    # Not yet configured

# Admin web - E2E tests
npm --workspace @reform/admin-web run test:e2e        # Run tests
npm --workspace @reform/admin-web run test:e2e:ui     # Interactive UI

# Root verification scripts
npm run verify:workspace                   # Validates workspace
npm run verify:schema                      # Validates schema
npm run verify:all                        # Both checks
```

**CI/CD Behavior (from playwright.config.ts):**
- Detect CI environment via `process.env.CI`
- Retries: 2 in CI, 0 locally
- Workers: 1 in CI (serial), multiple locally (parallel)
- forbidOnly: Fail if `.only` used in CI
