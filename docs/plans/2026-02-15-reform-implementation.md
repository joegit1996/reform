# Reform App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready v1 of Reform with Expo mobile, Supabase backend (`gym_app` schema only), AI chat via edge function, and admin document management web app.

**Architecture:** Monorepo with `apps/mobile`, `apps/admin-web`, and `supabase` migrations/functions. Canonical training plan data is seeded from the provided markdown, while user edits are stored in override tables. Chat runs through a server-side edge function using focus-scoped context from stored documents/chunks.

**Tech Stack:** Expo React Native, TypeScript, Expo Router, Supabase JS, Supabase SQL/RLS, Supabase Edge Functions (Deno), React + Vite (admin), markdown/pdf parsing utilities.

---

### Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `apps/mobile/`
- Create: `apps/admin-web/`
- Create: `packages/shared/`
- Create: `supabase/`
- Create: `.env.example`

**Step 1: Write the failing test**
- Add workspace smoke script that fails if `apps/mobile` or `apps/admin-web` is missing.

**Step 2: Run test to verify it fails**
- Run: `npm run verify:workspace`
- Expected: FAIL before directories/scripts exist.

**Step 3: Write minimal implementation**
- Configure workspaces and scripts.
- Add required root directories.

**Step 4: Run test to verify it passes**
- Run: `npm run verify:workspace`
- Expected: PASS.

**Step 5: Commit**
```bash
git add package.json .env.example apps admin-web packages supabase
git commit -m "chore: initialize reform monorepo layout"
```

### Task 2: Bootstrap Expo Mobile App

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app/(tabs)/`
- Create: `apps/mobile/src/theme/theme.ts`
- Create: `apps/mobile/src/components/`

**Step 1: Write the failing test**
- Add mobile route existence test/smoke script for tabs: Plan, Articles, Chat, Profile.

**Step 2: Run test to verify it fails**
- Run: `npm run verify:mobile-routes`
- Expected: FAIL because routes/screens are absent.

**Step 3: Write minimal implementation**
- Create Expo app shell with tab navigation.
- Add global dark theme tokens and base layout.

**Step 4: Run test to verify it passes**
- Run: `npm run verify:mobile-routes`
- Expected: PASS.

**Step 5: Commit**
```bash
git add apps/mobile
git commit -m "feat(mobile): scaffold expo app with tab navigation and theme"
```

### Task 3: Create Supabase Schema in `gym_app`

**Files:**
- Create: `supabase/migrations/20260215_001_create_gym_app_schema.sql`
- Create: `supabase/migrations/20260215_002_rls_policies.sql`

**Step 1: Write the failing test**
- Add schema validation script that fails if any required table is in `public`.

**Step 2: Run test to verify it fails**
- Run: `npm run verify:schema`
- Expected: FAIL before migration files exist.

**Step 3: Write minimal implementation**
- Create `gym_app` schema and all required tables.
- Add indexes and FK constraints.
- Add RLS policies for user/private/admin boundaries.

**Step 4: Run test to verify it passes**
- Run: `npm run verify:schema`
- Expected: PASS; all objects in `gym_app`.

**Step 5: Commit**
```bash
git add supabase/migrations
git commit -m "feat(db): add gym_app schema tables and rls policies"
```

### Task 4: Build Plan and Article Parser

**Files:**
- Create: `packages/shared/src/parser/planParser.ts`
- Create: `packages/shared/src/parser/articleParser.ts`
- Create: `packages/shared/src/parser/__tests__/parser.test.ts`

**Step 1: Write the failing test**
- Test extraction of:
  - 16-week phases
  - day rows and exercises
  - category assignment for article sections

**Step 2: Run test to verify it fails**
- Run: `npm run test:parser`
- Expected: FAIL with parser not implemented.

**Step 3: Write minimal implementation**
- Parse markdown table rows for week/day plan.
- Parse heading sections for article bodies.
- Apply rule-based category mapping.

**Step 4: Run test to verify it passes**
- Run: `npm run test:parser`
- Expected: PASS.

**Step 5: Commit**
```bash
git add packages/shared
git commit -m "feat(parser): extract training plan and categorized articles from markdown"
```

### Task 5: Seed Mountaineering Focus Data

**Files:**
- Create: `supabase/seed/seed_mountaineering.ts`
- Create: `supabase/seed/run-seed.ts`

**Step 1: Write the failing test**
- Add seed dry-run test expecting one focus, one active plan, 16 weeks, days/exercises, article entries.

**Step 2: Run test to verify it fails**
- Run: `npm run test:seed`
- Expected: FAIL before seed scripts exist.

**Step 3: Write minimal implementation**
- Use parser output to upsert canonical focus, plan, week/day/exercise rows, and article chunks.

**Step 4: Run test to verify it passes**
- Run: `npm run test:seed`
- Expected: PASS with expected counts.

**Step 5: Commit**
```bash
git add supabase/seed
git commit -m "feat(seed): seed mountaineering plan and article content"
```

### Task 6: Implement Mobile Plan Screens and Checklist UX

**Files:**
- Create: `apps/mobile/src/features/plan/PlanHomeScreen.tsx`
- Create: `apps/mobile/src/features/plan/WeekScreen.tsx`
- Create: `apps/mobile/src/features/plan/DayScreen.tsx`
- Create: `apps/mobile/src/features/plan/components/*.tsx`

**Step 1: Write the failing test**
- Add component tests for:
  - today highlight
  - exercise check toggle
  - day completion state
  - progress bar rendering

**Step 2: Run test to verify it fails**
- Run: `npm run test:mobile-plan`
- Expected: FAIL before screens/components exist.

**Step 3: Write minimal implementation**
- Build checklist-first day screen with compact actionable cards.
- Add completion toggles and weekly progress calculations.

**Step 4: Run test to verify it passes**
- Run: `npm run test:mobile-plan`
- Expected: PASS.

**Step 5: Commit**
```bash
git add apps/mobile/src/features/plan
git commit -m "feat(mobile): add plan checklist views with progress tracking"
```

### Task 7: Implement User Override Editing

**Files:**
- Create: `apps/mobile/src/features/plan/EditDayScreen.tsx`
- Create: `apps/mobile/src/features/plan/hooks/useDayOverrides.ts`
- Modify: `apps/mobile/src/features/plan/DayScreen.tsx`

**Step 1: Write the failing test**
- Add tests for:
  - add exercise
  - delete exercise
  - update rest day
  - save notes
  - preserved canonical baseline

**Step 2: Run test to verify it fails**
- Run: `npm run test:mobile-overrides`
- Expected: FAIL before override logic exists.

**Step 3: Write minimal implementation**
- Create copy-on-edit override writes to `user_day_overrides` and `user_exercise_overrides`.

**Step 4: Run test to verify it passes**
- Run: `npm run test:mobile-overrides`
- Expected: PASS.

**Step 5: Commit**
```bash
git add apps/mobile/src/features/plan
git commit -m "feat(mobile): support user-specific day and exercise overrides"
```

### Task 8: Implement Articles Feature

**Files:**
- Create: `apps/mobile/src/features/articles/ArticlesScreen.tsx`
- Create: `apps/mobile/src/features/articles/ArticleDetailScreen.tsx`
- Create: `apps/mobile/src/features/articles/components/*.tsx`

**Step 1: Write the failing test**
- Add tests for category filtering and article rendering.

**Step 2: Run test to verify it fails**
- Run: `npm run test:mobile-articles`
- Expected: FAIL before article screens exist.

**Step 3: Write minimal implementation**
- Build category chips and article list/detail pages from Supabase data.

**Step 4: Run test to verify it passes**
- Run: `npm run test:mobile-articles`
- Expected: PASS.

**Step 5: Commit**
```bash
git add apps/mobile/src/features/articles
git commit -m "feat(mobile): add categorized educational articles flow"
```

### Task 9: Implement Chat Edge Function + Mobile Chat Screen

**Files:**
- Create: `supabase/functions/chat/index.ts`
- Create: `apps/mobile/src/features/chat/ChatScreen.tsx`
- Create: `apps/mobile/src/features/chat/useChat.ts`

**Step 1: Write the failing test**
- Add edge function test for authenticated request and context retrieval.
- Add chat UI test for send/render cycle.

**Step 2: Run test to verify it fails**
- Run: `npm run test:chat`
- Expected: FAIL before function and hook exist.

**Step 3: Write minimal implementation**
- Edge function:
  - verify user auth
  - load focus-specific context and recent history
  - call Qwen model using `qwen_api_key`
  - persist and return assistant reply
- Mobile chat:
  - message list
  - pending state
  - retry path

**Step 4: Run test to verify it passes**
- Run: `npm run test:chat`
- Expected: PASS.

**Step 5: Commit**
```bash
git add supabase/functions/chat apps/mobile/src/features/chat
git commit -m "feat(chat): add qwen-backed edge chat with focus context"
```

### Task 10: Build Admin Web App

**Files:**
- Create: `apps/admin-web/package.json`
- Create: `apps/admin-web/src/pages/DocumentsPage.tsx`
- Create: `apps/admin-web/src/components/DocumentUpload.tsx`
- Create: `apps/admin-web/src/lib/supabase.ts`

**Step 1: Write the failing test**
- Add tests for upload/list/delete actions and focus assignment.

**Step 2: Run test to verify it fails**
- Run: `npm run test:admin`
- Expected: FAIL before admin pages exist.

**Step 3: Write minimal implementation**
- Build admin page for:
  - upload markdown/pdf
  - assign existing/new focus
  - list docs
  - delete docs
- Wire to Supabase storage + `gym_app.documents`.

**Step 4: Run test to verify it passes**
- Run: `npm run test:admin`
- Expected: PASS.

**Step 5: Commit**
```bash
git add apps/admin-web
git commit -m "feat(admin): add document management panel for focus context"
```

### Task 11: Add Design System and WCAG Checks

**Files:**
- Modify: `apps/mobile/src/theme/theme.ts`
- Create: `apps/mobile/src/theme/contrast.test.ts`
- Modify: `apps/mobile/src/components/**/*.tsx`

**Step 1: Write the failing test**
- Add color contrast tests for key text/background combinations to meet WCAG AA.

**Step 2: Run test to verify it fails**
- Run: `npm run test:a11y`
- Expected: FAIL before adjustments.

**Step 3: Write minimal implementation**
- Finalize dark elevation surfaces, orange accents, typography, and spacing tokens.
- Update components to conform to tokenized styles.

**Step 4: Run test to verify it passes**
- Run: `npm run test:a11y`
- Expected: PASS.

**Step 5: Commit**
```bash
git add apps/mobile/src/theme apps/mobile/src/components
git commit -m "style(mobile): apply tokenized dark theme and accessibility-safe contrast"
```

### Task 12: Final Verification and Runbook

**Files:**
- Create: `README.md`
- Create: `docs/runbooks/local-setup.md`
- Modify: root scripts for end-to-end checks

**Step 1: Write the failing test**
- Add CI/local verification script requiring all test suites and type checks to pass.

**Step 2: Run test to verify it fails**
- Run: `npm run verify:all`
- Expected: FAIL before scripts/docs are complete.

**Step 3: Write minimal implementation**
- Add setup docs for:
  - mobile app start
  - admin web start
  - supabase local/dev migration
  - seeding and edge function deploy

**Step 4: Run test to verify it passes**
- Run: `npm run verify:all`
- Expected: PASS.

**Step 5: Commit**
```bash
git add README.md docs/runbooks package.json
git commit -m "docs: add local setup runbook and full verification scripts"
```

### Task 13: Implement Production RAG Context Enrichment and Retrieval

**Files:**
- Create: `supabase/migrations/20260219_001_enable_pgvector_and_embeddings.sql`
- Create: `supabase/migrations/20260220_001_hybrid_retrieval_functions.sql`
- Create: `supabase/functions/index-document/index.ts`
- Modify: `supabase/functions/chat/index.ts`
- Modify: `apps/admin-web/src/pages/DocumentsPage.tsx`
- Modify: `apps/admin-web/src/components/DocumentUpload.tsx`
- Modify: `docs/runbooks/local-setup.md`

**Step 1: Write the failing test**
- Add retrieval tests that fail unless:
  - vector similarity retrieval returns focus-scoped chunks
  - lexical fallback retrieval works for exact term queries
  - hybrid merge + rerank returns grounded top results
- Add chat test that fails unless citation metadata is returned.

**Step 2: Run test to verify it fails**
- Run: `npm run test:rag`
- Expected: FAIL before vector tables/functions are implemented.

**Step 3: Write minimal implementation**
- Add `pgvector` extension and embeddings table in `gym_app` only.
- Add ingestion function for document indexing:
  - parse/chunk markdown or extracted PDF text
  - generate embeddings
  - write chunks + embeddings with focus/document metadata
- Upgrade chat retrieval:
  - apply metadata filters (`focus_id`, active docs)
  - perform hybrid retrieval (vector + lexical)
  - apply rerank and send top-k context blocks
  - return citations (document title + chunk id) with answer.
- Add admin controls:
  - trigger reindex on upload
  - reindex/delete index for existing docs.

**Step 4: Run test to verify it passes**
- Run: `npm run test:rag`
- Expected: PASS with deterministic retrieval assertions and citation payload checks.

**Step 5: Commit**
```bash
git add supabase/migrations supabase/functions apps/admin-web docs/runbooks
git commit -m "feat(rag): add hybrid retrieval, embeddings index, rerank, and citations"
```
