# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Monorepo with distributed client-server architecture using Supabase as unified backend.

**Key Characteristics:**
- **Workspace pattern:** Yarn monorepo with shared packages, multiple applications
- **Client-centric:** Two primary client applications (mobile native, web admin) with independent feature organization
- **Backend-as-a-service:** Supabase provides auth, database, storage, and extensibility via Edge Functions
- **Domain focus:** Applications organized around user-facing features ("focuses") - each focus is a training domain

## Layers

**Presentation Layer (Client):**
- Purpose: Render UI, handle user interactions, manage local state
- Location: `apps/mobile/src` (React Native via Expo), `apps/admin-web/src` (React + Vite)
- Contains: Components (`.tsx`), pages, feature-specific screens, styling
- Depends on: Supabase client SDK, shared utilities
- Used by: End users (mobile), administrators (web)

**Feature Layer:**
- Purpose: Encapsulate domain logic organized by user-facing features
- Location: `apps/mobile/src/features/` (plan, nutrition-log, chat, profile, articles, focus, nutrition)
- Contains: Feature screens, hooks, business logic, type definitions
- Depends on: Supabase, shared parsers, theme/lib
- Used by: Router, root layout

**Data Access Layer:**
- Purpose: Abstract Supabase queries and mutations
- Location: `apps/mobile/src/features/*/api.ts`, `apps/mobile/src/lib/supabase.ts`
- Contains: Type definitions for database rows, query builders, data transformation
- Depends on: Supabase client SDK
- Used by: Feature hooks and screens

**Shared/Core Layer:**
- Purpose: Provide reusable business logic and parsers
- Location: `packages/shared/src/` (planParser, articleParser)
- Contains: Markdown/text parsing, data transformation, utility functions
- Depends on: None (standalone)
- Used by: Client applications, potentially serverless functions

**Serverless Backend Layer:**
- Purpose: Extend Supabase with custom business logic and AI integrations
- Location: `supabase/functions/`
- Contains: Edge Functions for chat, document indexing, meal analysis
- Depends on: Supabase admin/auth APIs, external AI services (OpenRouter, Qwen)
- Used by: Client applications via HTTP

**Database Layer:**
- Purpose: Store and query all application data
- Schema: `gym_app` in Supabase PostgreSQL
- Tables: profiles, focuses, documents, document_chunks, user_meals, user_meal_items, user_nutrition_profiles, chat_messages, and more
- Used by: All client and serverless code via Supabase client

## Data Flow

**User Authentication Flow:**

1. User initiates login on mobile (`AuthScreen`)
2. Supabase auth triggered with auth session
3. Root layout (`_layout.tsx`) monitors auth state via `onAuthStateChange`
4. Profile created/upserted if missing
5. Nutrition profile status checked
6. User redirected to appropriate screen (NutritionOnboardingScreen or main app)

**Focus Management Flow:**

1. Admin creates focus via `DocumentsPage` (admin-web)
2. Focus stored in `focuses` table
3. Mobile apps load active focuses via `FocusProvider` context
4. Users select current focus stored in `profiles.current_focus_id`
5. Chat and documents scoped by focus ID

**Document Indexing and AI Chat Flow:**

1. Admin uploads document via `DocumentUpload` component
2. File stored in Supabase storage, metadata in `documents` table
3. `index-document` Edge Function triggered, chunks document using markdown headers
4. Chunks embedded via OpenRouter API, stored in `document_chunks` with vector embeddings
5. User sends chat message via `ChatScreen`
6. `chat` Edge Function retrieves relevant chunks using hybrid search (lexical + vector)
7. Context chunks passed to Qwen LLM with chat history
8. Response and citations stored and returned

**Meal Logging and Nutrition Flow:**

1. User logs meal via `MealLogScreen`
2. Sends image to `analyze-meal` Edge Function
3. Function analyzes meal composition (AI-powered)
4. Meal and items stored in `user_meals` and `user_meal_items`
5. Macros aggregated daily via `fetchDailyMacroTotals`
6. Progress displayed against nutrition targets in `MacroCard`

**Plan Execution Flow:**

1. Admin creates/imports training plan via `PlanBuilder`
2. Plan text parsed by shared `planParser` (markdown/text extraction)
3. Weekly plan stored, exercises indexed
4. Mobile app loads plan via `usePlanWeek` hook
5. User logs exercise sets/cardio metrics per day
6. Progress persisted to `set_logs` table
7. UI tracks set completion, weight/distance progression

**State Management Flow:**

1. Mobile root layout establishes `FocusProvider` context for focus selection
2. Each feature manages local state via `useState` hooks
3. Data fetching via `useEffect` triggered by auth state or manual refresh
4. Supabase realtime subscriptions not heavily used (polling-based)
5. No global state management library (prop drilling + context)

## Key Abstractions

**FocusProvider (Context API):**
- Purpose: Manage and provide current user focus across app
- Examples: `apps/mobile/src/features/focus/useCurrentFocus.ts`
- Pattern: Custom context provider with hook interface
- Usage: Wraps app at root level, allows any screen to access `useCurrentFocus()`

**Supabase Client Singleton:**
- Purpose: Centralize database and auth connection
- Examples: `apps/mobile/src/lib/supabase.ts`, `apps/admin-web/src/lib/supabase.ts`
- Pattern: Single instance created per app, configured with schema name
- Usage: Imported directly into features for queries

**Feature-Based Organization:**
- Purpose: Scope business logic to user-facing domains
- Examples: `apps/mobile/src/features/nutrition-log/`, `apps/mobile/src/features/plan/`
- Pattern: Each feature contains screens, hooks, types, and API layer
- Usage: Router navigates to feature screens, features handle their own data fetching

**Parser Layer (Shared):**
- Purpose: Extract structured data from markdown/text
- Examples: `packages/shared/src/parser/planParser.ts`, `packages/shared/src/parser/articleParser.ts`
- Pattern: Pure functions that transform text into typed data structures
- Usage: Parse admin-uploaded plans/articles, re-parse via Edge Functions

**Edge Function Pattern:**
- Purpose: Serverless business logic with direct database access
- Examples: `supabase/functions/chat/`, `supabase/functions/index-document/`
- Pattern: Deno TypeScript, CORS-aware, manual auth handling
- Usage: Triggered via HTTP from clients or within Supabase triggers

## Entry Points

**Mobile App:**
- Location: `apps/mobile/app/index.tsx` → `apps/mobile/app/_layout.tsx`
- Triggers: Expo start command, routes to `/(tabs)` navigation structure
- Responsibilities: Auth state initialization, profile/nutrition setup, root context providers, tab navigation setup

**Admin Web App:**
- Location: `apps/admin-web/src/main.tsx`
- Triggers: Vite dev server or build, renders single page
- Responsibilities: Mount React app, render DocumentsPage as primary interface

**Supabase Functions:**
- Location: `supabase/functions/chat/index.ts`, `supabase/functions/index-document/index.ts`
- Triggers: HTTP POST requests from clients or internal Supabase hooks
- Responsibilities: AI integrations, document processing, data retrieval and transformation

## Error Handling

**Strategy:** Try-catch at feature boundaries, user-facing error messages via UI state/toasts.

**Patterns:**
- **Client errors:** Stored in feature-level state (e.g., `error`, `docsError`), displayed in UI
- **Auth errors:** Caught in root layout, redirect to login/onboarding
- **Network errors:** Logged but fallback data provided (e.g., `usePlanWeek` uses sample data)
- **Validation errors:** Field-level error state (`FocusFieldErrors`, `fieldErrors`)
- **API errors:** Edge Functions return 4xx/5xx with JSON error, clients handle per-endpoint

## Cross-Cutting Concerns

**Logging:** Console logging via `console.log/error`, no centralized logging service configured.

**Validation:**
- Form validation at component level (e.g., focus name/slug validation in `DocumentsPage`)
- Database constraints at schema level
- Type safety via TypeScript

**Authentication:**
- Supabase session-based (auth token in Authorization header)
- Auth state monitored in root layout
- Role-based access via `profiles.role` field (admin vs user)
- Edge Functions validate auth header and extract user ID

**Authorization:**
- Mobile: All queries scoped to authenticated user ID (`eq("user_id", user.id)`)
- Admin web: Requires admin role, checked against `profiles.role`
- Edge Functions: Check user auth, validate focus ownership/scope
