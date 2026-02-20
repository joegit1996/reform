# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**Type Casting with `any`:**
- Issue: 32+ instances of `as any` type casts used to bypass TypeScript type checking, particularly around FontAwesome icon types and data transformation from Supabase queries
- Files:
  - `apps/mobile/src/features/plan/components/ChecklistItem.tsx` (lines 146, 158, 161, 176, 246)
  - `apps/mobile/src/features/plan/components/RestDayCard.tsx` (line 12)
  - `apps/mobile/src/features/profile/ProfileScreen.tsx` (lines 88-91)
  - `apps/mobile/app/_layout.tsx` (lines 37-40)
  - `supabase/functions/analyze-meal/index.ts` (line 140)
  - `apps/mobile/src/features/nutrition-log/api.ts` (lines 55, 75, 102-105)
- Impact: Type safety not enforced; refactoring becomes risky; bugs could hide until runtime
- Fix approach: Define proper types for Supabase response objects; create type-safe wrapper functions instead of casting; properly type FontAwesome icons

**Weakly Typed Data From External APIs:**
- Issue: Direct casting of external API responses (from Supabase, OpenRouter) without validation. Example: `mapFallbackChunks` accepts `any[]` parameter and directly accesses nested properties with optional chaining defaults
- Files:
  - `supabase/functions/chat/retrieval.ts` (line 34, `rows: any[]` parameter)
  - `supabase/functions/chat/index.ts` (line 136, casting as `any[]`)
  - `supabase/functions/analyze-meal/index.ts` (line 19, `sanitizeItems` accepts `any[]`)
- Impact: Schema mismatches from API changes could silently produce incorrect data; no early error detection
- Fix approach: Create Zod/io-ts validators for all external API responses; validate at response boundary before processing

**Repetitive State Management in Large Components:**
- Issue: Single components manage 10+ useState hooks and complex interdependent state, making state updates prone to consistency bugs
- Files:
  - `apps/admin-web/src/components/PlanBuilder.tsx` (2268 lines) - manages plans, phases, weeks, days, exercises, CSV parsing, uploads with multiple state arrays
  - `apps/mobile/src/features/plan/PlanHomeScreen.tsx` (1298 lines) - manages week number, days, exercise logs, inline editing, macro tracking with nested state updates
  - `apps/admin-web/src/pages/DocumentsPage.tsx` (1208 lines) - manages documents, focuses, filters, sorting, batch operations across multiple views
- Impact: State update race conditions; inconsistent UI state; hard to trace bugs through multiple setState calls
- Fix approach: Extract state management to custom hooks or external state library (Zustand, Context); break components into smaller focused components with single responsibilities

## Known Bugs

**Stale Session Token in Chat:**
- Symptoms: Chat endpoint may use expired `access_token` if exactly at 30-second boundary before expiry
- Files: `apps/mobile/src/features/chat/ChatScreen.tsx` (lines 60-64)
- Trigger: Send chat message within 30 seconds before session expires
- Workaround: Manual refresh or re-sign-in resolves it
- Root cause: Refresh logic checks `(session.expires_at ?? 0) * 1000 < Date.now() + 30_000` but if token expires between check and API call, it's invalid

**Meal Analysis Auth Is Optional (By Design But Risky):**
- Symptoms: Meal analysis endpoint skips auth validation and logs warnings instead of failing
- Files: `supabase/functions/analyze-meal/index.ts` (lines 42-55)
- Trigger: Request with no Authorization header or expired session still processes
- Workaround: Frontend enforces auth, but backend won't reject unauthenticated requests
- Risk: If frontend auth check is bypassed, backend doesn't protect; exposes API quota to unauthorized use

## Security Considerations

**Unauthenticated API Access:**
- Risk: `analyze-meal` function treats missing auth as optional warning rather than error, allowing unauthenticated callers to invoke AI meal analysis (quotas/costs)
- Files: `supabase/functions/analyze-meal/index.ts` (line 42-55: `if (authHeader) { ... }` pattern)
- Current mitigation: Frontend enforces auth before calling; Supabase RLS policies (assumed in place)
- Recommendations:
  - Make auth required; throw 401 on missing Authorization header
  - Add rate limiting by IP or API key
  - Monitor unauthorized attempt logs

**Hardcoded CORS `"*"` Wildcard:**
- Risk: Both `chat` and `analyze-meal` functions allow requests from any origin
- Files:
  - `supabase/functions/chat/index.ts` (line 5)
  - `supabase/functions/analyze-meal/index.ts` (line 3)
- Current mitigation: Authorization header required (but optional in analyze-meal)
- Recommendations:
  - Restrict CORS to known frontend origins (mobile app deeplink schemes, admin web domain)
  - Document reasoning if wildcard is intentional

**Model Output Not Validated for Injection:**
- Risk: AI model responses (Qwen) are inserted directly into chat history and database without sanitization
- Files: `supabase/functions/chat/index.ts` (line 191, 197: model response saved as-is)
- Current mitigation: Displayed as text in chat bubbles (React escapes HTML)
- Recommendations:
  - Add schema validation for model response (already done for meal analysis via JSON schema)
  - Consider content filtering for harmful outputs

**Plaintext Credentials in Environment:**
- Risk: API keys (Qwen, Supabase service role) stored in `.env` files
- Files: `.env`, `.env.local`, `.env` (mobile)
- Current mitigation: `.env` files ignored by git (assumed via `.gitignore`)
- Recommendations:
  - Verify `.gitignore` contains `.env*` patterns
  - Use Supabase vault for sensitive secrets instead of environment variables where possible
  - Rotate keys regularly; monitor logs for exposure

## Performance Bottlenecks

**No Pagination for Meal History:**
- Problem: `fetchRecentMeals()` fetches last 14 days of all meals with all nested items in one query; could be hundreds of rows on a user with consistent tracking
- Files: `apps/mobile/src/features/nutrition-log/api.ts` (lines 61-79)
- Cause: No limit or pagination; full nested select with `user_meal_items`
- Improvement path:
  - Add limit to 20 recent meals
  - Implement infinite scroll/pagination in UI
  - Lazy-load items only when meal is expanded

**Synchronous State Mutations in Event Handlers:**
- Problem: Multiple `setState` calls in rapid succession without batching in `PlanHomeScreen` exercise logging (lines 400+)
- Files: `apps/mobile/src/features/plan/PlanHomeScreen.tsx`
- Cause: Each weight/rep input change triggers separate state updates for weight, reps, then day completion
- Improvement path:
  - Batch state updates with `useCallback` and object spread
  - Consider debouncing input handlers
  - Profile render performance with React DevTools

**Inefficient CSV Parsing:**
- Problem: Custom CSV parser implemented by character iteration in `PlanBuilder.tsx` (lines 233-256); scales O(n) per line, could be thousands
- Files: `apps/admin-web/src/components/PlanBuilder.tsx` (lines 233-256)
- Cause: Re-implementing CSV parsing instead of using CSV library
- Improvement path:
  - Replace with `papaparse` or `csv-parse` library
  - Validate performance on large plan files (100+ weeks)

**N+1 Query Pattern in Chat Retrieval:**
- Problem: Separately calls lexical search and vector search, then makes fallback query if both return empty
- Files: `supabase/functions/chat/index.ts` (lines 104-136)
- Cause: Three separate database calls to handle fallback case
- Improvement path:
  - Parallelize lexical and vector calls (already done with `Promise.all`)
  - Move fallback logic to database RPC to reduce network round trips

## Fragile Areas

**CSV Import Schema Validation:**
- Files: `apps/admin-web/src/components/PlanBuilder.tsx` (lines 118-141, lines 233-272)
- Why fragile:
  - Custom CSV parser doesn't handle edge cases (quoted commas, escaped quotes properly)
  - Only checks required headers exist, doesn't validate column order
  - parseOptionalInt/parseOptionalNumber silently accept malformed input
- Safe modification:
  - Add comprehensive test cases for CSV edge cases
  - Use established CSV library
  - Add cell-level validation with error reporting by row/column
- Test coverage: No test file for PlanBuilder CSV logic exists

**Focus Scope Filter String Construction:**
- Files: `apps/mobile/src/features/focus/focusScope.ts` (line 2: `scope.eq.global,focus_id.eq.${currentFocusId}`)
- Why fragile:
  - Filter string directly interpolates focusId without validation
  - If focusId contains special characters, Supabase filter query could fail silently
  - No type checking on filter syntax itself
- Safe modification:
  - Add UUID validation before interpolation
  - Consider Supabase JS SDK filter helpers instead of string concatenation
- Test coverage: Covered by `focusScope.test.ts` but only tests happy paths

**Chat Message History Not Truncated:**
- Files: `supabase/functions/chat/index.ts` (lines 95-102: fetches last 8 messages)
- Why fragile:
  - If context window approaches token limit, subsequent calls will fail silently
  - No size limit on context; older messages with long content could exceed limits
  - Token count not validated
- Safe modification:
  - Implement token counting before sending to Qwen
  - Add safeguard to truncate oldest messages if over limit
- Test coverage: No test for message truncation scenarios

**Hardcoded Exercise Type Enum:**
- Files: `apps/admin-web/src/components/PlanBuilder.tsx` (line 49: `"weight_lifting" | "cardio" | "stairmaster"`)
- Why fragile:
  - If database schema adds new exercise types, code breaks at import
  - Duplication between admin and mobile app
- Safe modification:
  - Extract enum to shared package
  - Query valid types from database if dynamic
- Test coverage: CSV parser tested but no validation of exercise_type values

## Test Coverage Gaps

**Mobile App - No Unit Tests for Data Fetching:**
- What's not tested: All nutrition-log API functions, plan fetching, focus selection, authentication token refresh logic
- Files:
  - `apps/mobile/src/features/nutrition-log/api.ts` (no test file)
  - `apps/mobile/src/features/plan/usePlanWeek.ts` (no test file)
  - `apps/mobile/src/features/focus/useCurrentFocus.ts` (no test file)
- Risk: Refactoring Supabase queries or changing response shape breaks app without clear error
- Priority: High - core data flow untested

**Admin Web - No Component Tests:**
- What's not tested: `PlanBuilder` CSV import (2268 lines), `DocumentUpload`, `DocumentsPage` focus management, error handling
- Files:
  - `apps/admin-web/src/components/PlanBuilder.tsx` (no test file)
  - `apps/admin-web/src/components/DocumentUpload.tsx` (no test file)
  - `apps/admin-web/src/pages/DocumentsPage.tsx` (no test file)
- Risk: Major refactors could break admin workflows; manual testing only
- Priority: High - complex business logic in large components

**Supabase Functions - Limited Edge Case Testing:**
- What's not tested:
  - Chat function: Empty query, very long messages, session handling edge cases, embedding model fallback
  - Analyze-meal: Invalid image formats, timeout handling, model response schema validation
  - Index-document: Large PDF chunking, duplicate content, encoding issues
- Files:
  - `supabase/functions/chat/index.ts` (no error scenario tests)
  - `supabase/functions/analyze-meal/index.ts` (no test file)
  - `supabase/functions/index-document/index.ts` (no test file)
- Risk: Production failures from unexpected inputs or API errors
- Priority: Medium - edge cases handled but not proven

**E2E Tests - Limited Scope:**
- What's not tested: Chat workflow, meal logging, plan progression, focus switching
- Files:
  - `apps/admin-web/e2e/admin-auth.spec.ts` (auth only)
  - `apps/admin-web/e2e/multifocus-scope.spec.ts` (focus isolation only)
- Coverage: Authentication and authorization verified, core workflows not verified
- Priority: Medium - happy path needs verification

**Missing Integration Tests:**
- What's not tested: Supabase function + frontend integration, database schema changes don't break queries, multi-user concurrent access
- Risk: Database migration could silently break queries without test coverage
- Priority: Low - covered by E2E but not isolated

## Scaling Limits

**Chat Context Window:**
- Current capacity: 8 recent messages + 10 document chunks (approximate 5-10KB typical)
- Limit: Qwen model has ~30K token context; with system prompt + 8 messages + chunks, margin is ~15-20K tokens
- Scaling path:
  - Monitor actual token usage with middleware
  - Implement progressive context truncation
  - Consider move to longer-context models (e.g., 200K token models)

**Document Indexing Throughput:**
- Current capacity: One document at a time via Deno function
- Limit: Large PDFs (500+ pages) could timeout; no background queue
- Scaling path:
  - Implement background job queue (Bull, RQ) for large documents
  - Add progress tracking and resumability
  - Add document size/page count limits with user feedback

**User Meal Tracking Storage:**
- Current capacity: No explicit limits observed; Supabase storage unlimited (depends on plan)
- Limit: If many users store base64 meal images, storage costs grow quickly
- Scaling path:
  - Archive old meal images to cold storage
  - Implement image compression/resizing
  - Consider external CDN for meal photos

**Concurrent Chat Sessions:**
- Current capacity: No connection pooling limits detected in Deno
- Limit: Deno Deploy has request limits per region
- Scaling path:
  - Monitor real-time API latency
  - Implement request queuing
  - Load test with concurrent users

## Dependencies at Risk

**OpenRouter AI API Dependency:**
- Risk: Service outages, price changes, model deprecations (currently using `qwen/qwen3-vl-235b-a22b-thinking`)
- Impact: Chat and meal analysis completely unavailable if OpenRouter down; no fallback
- Files: `supabase/functions/chat/index.ts`, `supabase/functions/analyze-meal/index.ts`
- Migration plan:
  - Abstract AI provider behind interface
  - Support multiple providers (OpenAI, Anthropic, local)
  - Implement provider fallback logic
  - Add circuit breaker for AI service unavailability

**Supabase Realtime Dependency:**
- Risk: Not currently used but UI could add live updates; Realtime has limitations
- Impact: If added, creates dependency on Supabase infrastructure
- Migration plan:
  - Evaluate WebSocket scaling costs
  - Consider alternatives (polling, Server-Sent Events)

**Expo/React Native Version Lock:**
- Risk: Mobile app tightly coupled to specific Expo SDK version; upgrading difficult with breaking changes
- Impact: Security patches in dependencies require coordinated Expo SDK upgrade
- Migration plan:
  - Keep Expo SDK updated regularly (monthly)
  - Test upgrades in CI before merging

## Missing Critical Features

**Error Recovery & Retry Logic:**
- Problem: Functions fail silently or show generic errors; no automatic retry with exponential backoff
- Blocks: Users can't recover from transient network errors without restarting app
- Recommendation: Implement retry decorator for async operations

**Offline Support:**
- Problem: App requires constant internet; no offline queueing or caching
- Blocks: Can't log exercises or meals when network unavailable
- Recommendation: Add local SQLite cache, implement sync queue on reconnect

**Rate Limiting on AI Endpoints:**
- Problem: No per-user rate limits on meal analysis or chat
- Blocks: Malicious actor could exhaust API quota; no cost controls
- Recommendation: Add Redis-based rate limiter; track usage per user

**Audit Logging:**
- Problem: No record of who accessed what data when; difficult to debug issues
- Blocks: Can't investigate unauthorized access or data changes
- Recommendation: Add audit table to Supabase; log all API calls with user context

**Data Backup & Recovery:**
- Problem: No documented backup strategy; user data loss is permanent
- Blocks: Can't recover from accidental deletion
- Recommendation: Enable Supabase Point-in-Time Recovery (PITR); document restore procedures

---

*Concerns audit: 2026-02-20*
