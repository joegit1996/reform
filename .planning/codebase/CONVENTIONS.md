# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `DocumentUpload.tsx`, `ChatScreen.tsx`)
- Utility/helper files: camelCase (e.g., `focusScope.ts`, `useCurrentFocus.ts`)
- Hook files: prefix with `use` in camelCase (e.g., `usePlanWeek.ts`, `useCurrentFocus.ts`)
- Type definition files: Match module name (e.g., `planParser.ts` exports `PlanWeek`, `PlanDay`)
- Test files: same name with `.test.ts` or `.spec.ts` suffix (e.g., `focusScope.test.ts`)

**Functions:**
- Regular functions: camelCase (e.g., `extractPdfText`, `triggerIndex`, `parseTrainingPlan`)
- React components: PascalCase (e.g., `DocumentUpload`, `ChatScreen`)
- Hook functions: `use` prefix in camelCase (e.g., `usePlanWeek`, `useCurrentFocus`)
- Private/internal functions: prefix with underscore or standard camelCase (e.g., `parseExerciseList`, `classifyCategory`)
- Event handlers: `handle` or `on` prefix (e.g., `handleSubmit`, `onUploaded`, `onNotify`)
- Setter functions from hooks: `set` prefix (e.g., `setTitle`, `setMessages`, `setBusy`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `DAY_MAP`, `CARDIO_PATTERN`, `STAIRMASTER_PATTERN`)
- Boolean variables: `is` or `has` prefix (e.g., `isRestDay`, `isCardio`, `hasError`, `needsSignIn`)
- State variables: descriptive camelCase (e.g., `currentFocus`, `fieldErrors`, `focusRefreshToken`)
- Mapped data/lookup tables: lowercase with underscores (e.g., `logByKey`, `previousByKey`)
- Array/collection suffixes: plural (e.g., `messages`, `focuses`, `exercises`, `weeks`)
- Temporary loop variables: single letter OK in tight scopes (e.g., `idx`, `i`)

**Types:**
- Type names: PascalCase (e.g., `PlanWeek`, `UiDay`, `Message`, `ArticleCategory`)
- Union types: inline, no naming convention needed (e.g., `"success" | "error" | "info"`)
- Function parameter types: destructure with types inline (e.g., `{ onUploaded, focusRefreshToken = 0 }`)
- Type suffix convention: `Ui` prefix for UI-specific types (e.g., `UiDay`, `UiExercise`, `UiSet`)
- Row suffix for database row types (e.g., `FocusRow`, `SetLogRow`)

## Code Style

**Formatting:**
- No linter/formatter detected in project
- Inferred style: 2-space indentation (observed in most files)
- Semicolons: Used consistently at end of statements
- Line length: Generally stays within ~120 characters

**Imports:**
- Order: React/external packages first, then local imports
- Path: Use relative imports (e.g., `import { supabase } from "../lib/supabase"`)
- Named exports preferred over default exports
- Grouped imports with blank lines between sections (React, external packages, local modules)

**JSDoc/Comments:**
- Minimal JSDoc usage
- Comments used for clarity on complex logic patterns (e.g., regex patterns, algorithmic steps)
- Section comments for major logical blocks within functions
- No comment style requirements enforced

## Error Handling

**Patterns:**
- Try-catch blocks for async operations (e.g., `await supabase.*`, `await fetch()`)
- Error coercion: `(err as Error).message` for type safety
- Error propagation: throw new Error() with descriptive messages
- Error state management: Often stored in component state (e.g., `setError`, `setFieldErrors`)
- Validation errors: Stored in field-specific error objects (e.g., `fieldErrors` object in `DocumentUpload`)
- Fallback UI states: When data loading fails, fallback to sample data (see `usePlanWeek`)

**Examples:**
```typescript
// Try-catch with type coercion
try {
  const { data, error } = await supabase.from("table").select();
  if (error) throw error;
} catch (err) {
  const message = (err as Error).message;
  setError(message);
}

// Field-level validation errors
const nextFieldErrors: { focusId?: string; file?: string } = {};
if (!file) nextFieldErrors.file = "Select a file.";
setFieldErrors(nextFieldErrors);

// Fallback rendering
if (active) {
  const usingFallback = mapped.length === 0;
  setState({
    loading: false,
    days: usingFallback ? mapFallbackDays() : mapped,
    error: usingFallback ? "No data found" : null,
    usingFallback
  });
}
```

## Component Design

**React Components:**
- Functional components with hooks
- Props destructuring in function parameters (e.g., `export function DocumentUpload({ onUploaded, focusRefreshToken = 0, onNotify }: Props)`)
- Props type defined as `type Props` immediately above component definition
- useEffect for side effects with dependency arrays
- Local state with useState for component-level state
- Conditional rendering with ternary or short-circuit `&&` (e.g., `{error ? <p>{error}</p> : null}`)

**Custom Hooks:**
- Return typed object with multiple properties (e.g., `return { ...state, retry: () => ... }`)
- Cleanup functions in useEffect return statements
- Active flag pattern for async operations in useEffect (prevent state updates after unmount)
- Sample data fallback pattern when API fails

**Styling:**
- React Native: `StyleSheet.create()` objects with theme reference (see `ChatScreen.tsx`)
- Web (React): inline className with CSS files (e.g., `className="panel"` in `DocumentUpload.tsx`)
- Theme constants: centralized in `src/theme/theme.ts` for React Native
- Theme access: destructure from theme constant (e.g., `backgroundColor: theme.colors.background`)

## Module Organization

**Exports:**
- Barrel files: `packages/shared/src/index.ts` uses `export * from`
- Named exports preferred
- Type exports included in barrel files
- Each module exports related functions and types together

**File Structure:**
- `src/` directory for source code
- `lib/` subdirectory for library/utility code (e.g., `lib/supabase.ts`)
- `components/` subdirectory for React components
- `features/` subdirectory for feature-specific code in mobile
- `theme/` subdirectory for styling constants
- `parser/` subdirectory for parsing utilities in shared package

## Async Patterns

**useState with async:**
- Wrap async calls in useEffect, not directly in setState
- Use void operator for fire-and-forget calls: `void (async () => { ... })()`
- Set loading state before async operation, clear it in finally block

**Supabase queries:**
- Destructure both data and error: `const { data, error } = await supabase...`
- Check error first, then null-check data
- Use chaining for query building: `.select().eq().order()`
- Single result queries: `.single()` method call

**Session management:**
- Check session expiry: `(session.expires_at ?? 0) * 1000 < Date.now() + 30_000`
- Refresh before sending authenticated requests
- Sign out on auth failure

## Type Safety

**TypeScript configuration:**
- Strict mode enabled (see `apps/admin-web/tsconfig.json`)
- Target: ES2020
- JSX mode: react-jsx
- Type coercion for errors: `(err as Error).message`
- Type assertions sparingly: `(data as FocusRow[])`
- satisfies keyword for type validation: `satisfies UiExercise`
