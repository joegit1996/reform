# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
Reform-Codex/
├── apps/
│   ├── mobile/               # React Native / Expo app for end users
│   │   ├── app/              # Expo Router file-based routing
│   │   ├── src/
│   │   │   ├── features/     # Feature-scoped business logic and screens
│   │   │   ├── lib/          # Supabase client and utilities
│   │   │   ├── theme/        # Design tokens and styling
│   │   │   └── components/   # Shared UI components (empty currently)
│   │   └── package.json
│   │
│   └── admin-web/            # React / Vite app for admins
│       ├── src/
│       │   ├── components/   # Admin-specific components
│       │   ├── pages/        # Page containers
│       │   ├── lib/          # Supabase client config
│       │   ├── main.tsx      # Entry point
│       │   └── styles.css    # Global styles
│       ├── index.html        # HTML template
│       └── package.json
│
├── packages/
│   └── shared/               # Shared utilities and parsers
│       ├── src/
│       │   ├── parser/       # Text/markdown parsing logic
│       │   └── index.ts      # Public exports
│       └── package.json
│
├── supabase/
│   ├── functions/            # Deno Edge Functions
│   │   ├── chat/             # AI-powered chat retrieval + response
│   │   ├── analyze-meal/     # Meal composition analysis
│   │   └── index-document/   # Document chunking and embedding
│   ├── migrations/           # Database schema migrations
│   ├── seed/                 # Seed data (optional)
│   └── .temp/                # Temporary Supabase CLI state
│
├── docs/                     # Documentation and runbooks
├── scripts/                  # Workspace validation and setup scripts
├── .planning/                # GSD planning directory
│   └── codebase/             # Architecture analysis documents
│
├── package.json              # Monorepo root (Yarn workspaces)
└── tsconfig.json             # TypeScript base config (extends Expo)
```

## Directory Purposes

**apps/mobile/:**
- Purpose: Consumer-facing mobile application
- Contains: React Native components, feature screens, navigation
- Key files: `app/_layout.tsx` (root), `src/features/*/` (feature implementation)

**apps/mobile/app/:**
- Purpose: Expo Router file-based routing structure
- Contains: Route definitions using file paths
- Key files: `_layout.tsx` (root layout with auth), `index.tsx` (redirects to tabs), `(tabs)/` (bottom tab navigation)

**apps/mobile/src/features/:**
- Purpose: Organize feature-specific business logic and screens
- Contains: Each folder = one feature with its own screens, hooks, types, API layer
- Features: `chat`, `plan`, `nutrition-log`, `articles`, `profile`, `nutrition`, `focus`
- Pattern: Screens are co-located with feature logic, not separated

**apps/mobile/src/lib/:**
- Purpose: Shared utilities and configuration
- Contains: Supabase client singleton, constants
- Key files: `supabase.ts` (client initialization with schema)

**apps/mobile/src/theme/:**
- Purpose: Design system and styling configuration
- Contains: Color palette, typography, spacing constants
- Key files: `theme.ts`

**apps/admin-web/src/:**
- Purpose: Admin dashboard implementation
- Contains: Page containers, reusable components, styling
- Key files: `pages/DocumentsPage.tsx` (main admin interface), `components/` (DocumentUpload, PlanBuilder, AdminAuthPanel)

**apps/admin-web/src/components/:**
- Purpose: Modular, reusable admin UI components
- Contains: Form components, upload handlers, data managers
- Key components:
  - `DocumentUpload.tsx` - File upload, PDF parsing, document metadata
  - `PlanBuilder.tsx` - Training plan creation and editing
  - `AdminAuthPanel.tsx` - Authentication UI

**packages/shared/src/parser/:**
- Purpose: Shared parsing and data extraction
- Contains: Pure functions for transforming text/markdown
- Key files:
  - `planParser.ts` - Extract exercises, sets, reps from markdown
  - `articleParser.ts` - Parse article structure

**supabase/functions/:**
- Purpose: Serverless Edge Functions for backend logic
- Runtime: Deno TypeScript
- Key functions:
  - `chat/index.ts` - RAG-enabled chat with document retrieval
  - `index-document/index.ts` - Document chunking and embedding
  - `analyze-meal/index.ts` - AI meal composition analysis

**supabase/migrations/:**
- Purpose: Database schema versioning
- Contains: SQL migration files in chronological order

## Key File Locations

**Entry Points:**

- `apps/mobile/app/index.tsx`: Mobile app entry (redirects to tabs)
- `apps/mobile/app/_layout.tsx`: Mobile root layout (auth, nutrition check, providers)
- `apps/admin-web/src/main.tsx`: Admin app React mount point
- `supabase/functions/chat/index.ts`: Chat endpoint
- `supabase/functions/index-document/index.ts`: Document processing endpoint

**Configuration:**

- `apps/mobile/package.json`: Mobile dependencies and scripts
- `apps/admin-web/package.json`: Admin web dependencies and scripts
- `apps/admin-web/vite.config.ts`: Vite build configuration
- `package.json` (root): Monorepo workspaces definition
- `tsconfig.json`: TypeScript compiler options (extends Expo base)

**Core Logic:**

- `apps/mobile/src/lib/supabase.ts`: Mobile Supabase client singleton
- `apps/admin-web/src/lib/supabase.ts`: Admin Supabase client singleton
- `apps/mobile/src/features/focus/useCurrentFocus.ts`: Focus context provider
- `apps/mobile/src/features/plan/usePlanWeek.ts`: Plan data fetching and transformation
- `apps/mobile/src/features/nutrition-log/api.ts`: Meal data queries
- `packages/shared/src/parser/planParser.ts`: Plan text parsing logic

**Styling:**

- `apps/admin-web/src/styles.css`: Admin global CSS
- `apps/mobile/src/theme/theme.ts`: Mobile design tokens

**Testing:**

- `apps/mobile/src/features/focus/focusScope.test.ts`: Unit test example
- `supabase/functions/chat/retrieval.test.ts`: Retrieval function tests
- `apps/admin-web/e2e/`: Playwright e2e tests (directory exists)

## Naming Conventions

**Files:**

- Components: PascalCase, `*.tsx` (e.g., `DocumentsPage.tsx`, `PlanBuilder.tsx`)
- Hooks: camelCase, `use*` prefix, `*.ts` (e.g., `usePlanWeek.ts`, `useCurrentFocus.ts`)
- API/Data: camelCase, `api.ts` or `lib.ts` (e.g., `api.ts` in feature folders)
- Types: Defined in feature files, no separate `*.d.ts` files (except parsers)
- Utilities: camelCase, descriptive name (e.g., `focusScope.ts`, `calculator.ts`)
- Tests: `*.test.ts` or `*.spec.ts` suffix

**Directories:**

- Features: kebab-case, singular or plural by convention (e.g., `nutrition-log`, `profile`, `plan`)
- Components: `components/` (lowercase)
- API layer: Co-located with feature (e.g., `features/nutrition-log/api.ts`)
- Pages: `pages/` (admin), `features/*/Screen.tsx` (mobile)

**Variables/Functions:**

- camelCase for variables, functions, hooks
- PascalCase for React components, types, interfaces
- UPPER_SNAKE_CASE for constants (e.g., `DAY_NAMES`, `CARDIO_PATTERN`)

## Where to Add New Code

**New Feature (Mobile):**
1. Create directory: `apps/mobile/src/features/{feature-name}/`
2. Create main screen: `apps/mobile/src/features/{feature-name}/{FeatureName}Screen.tsx`
3. Create API layer: `apps/mobile/src/features/{feature-name}/api.ts` (if data fetching needed)
4. Create types at top of screen or in separate `types.ts`
5. Add route file: `apps/mobile/app/(tabs)/{feature-slug}.tsx` (if adding tab)
6. Add to `/(tabs)/_layout.tsx` bottom tab navigator if user-facing

**New Component (Admin Web):**
1. Create file: `apps/admin-web/src/components/{ComponentName}.tsx`
2. Define types at top of file
3. Export from component file
4. Import and use in `apps/admin-web/src/pages/DocumentsPage.tsx` or new page file

**New Shared Utility:**
1. Create file: `packages/shared/src/{utility-name}.ts`
2. Export from `packages/shared/src/index.ts`
3. Import from `@reform/shared` in client apps

**New Database Query:**
1. Add to feature's `api.ts`: `apps/mobile/src/features/{feature-name}/api.ts`
2. Define row type at top
3. Create async function with error handling
4. Use query builder from Supabase client: `supabase.from("table").select(...)`

**New Edge Function:**
1. Create directory: `supabase/functions/{function-name}/`
2. Create file: `supabase/functions/{function-name}/index.ts`
3. Implement `Deno.serve()` handler with:
   - CORS header handling
   - Auth validation via Authorization header
   - Create Supabase clients (user-scoped and admin)
   - Business logic
   - Error handling (try-catch returning 500)
4. Register in `supabase.json` if needed for deployment

**New Test:**
- Unit tests: Co-locate next to code with `*.test.ts` suffix
- E2E tests: Add to `apps/admin-web/e2e/` directory for Playwright
- Pattern: Use `describe` / `it` (if testing framework available), assertions with built-in or standard library

## Special Directories

**apps/mobile/app/(tabs)/:**
- Purpose: Bottom tab navigation screens
- Generated: Partially (Expo Router auto-generates from file structure)
- Committed: Yes
- Contains: Route files that map to feature screens

**supabase/.temp/:**
- Purpose: Supabase CLI temporary state
- Generated: Yes (auto-generated by Supabase CLI)
- Committed: No (should be in .gitignore)
- Contents: Temporary CLI state, migrations status

**docs/:**
- Purpose: Project documentation, runbooks, requirements
- Generated: No (manually authored)
- Committed: Yes
- Contains: Deployment guides, architecture diagrams, requirements

**.planning/codebase/:**
- Purpose: GSD codebase analysis and planning documents
- Generated: Yes (auto-generated by GSD agent)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.

**.expo/ and .expo-export-test*:**
- Purpose: Expo prebuild caches
- Generated: Yes (auto-generated by Expo)
- Committed: No (should be in .gitignore)
- Usage: Can be safely deleted and regenerated

## Key Patterns to Follow

**Feature Organization:**
- Keep feature code self-contained in `features/{name}/`
- Feature screens can import from other features only via explicit exports
- API logic stays in `api.ts` within the feature

**State Management:**
- Use React hooks (`useState`, `useContext`) for local state
- Use context for cross-feature state (see `FocusProvider`)
- No Redux or MobX (keep simple)

**Type Definitions:**
- Define row types near queries (top of `api.ts`)
- Define UI types near components (top of screen file)
- Export commonly used types if used across features

**Data Fetching:**
- Use `useEffect` with auth state as dependency
- Handle loading/error states with `useState`
- Provide fallback data if available (e.g., sample plans)

**Async Operations:**
- Wrap in try-catch
- Set loading/error states
- Use `finally` to clean up (e.g., setBusy(null))
