# Reform Multi-Focus System - Implementation Plan

## Objective
Enable Reform to support multiple focuses selected by each user, with admin-managed focus metadata, scoped/global context documents, and focus-specific training plans that can be edited in UI or imported by CSV.

## Scope
- Mobile: focus selection and scoped data loading for Plan, Articles, Chat.
- Admin web: focus CRUD, scoped document upload, plan management foundation.
- Backend/Supabase: schema + policies + retrieval behavior for focus/global context.

## Status Snapshot (Updated 2026-02-19)
- Overall: Core multi-focus implementation is complete for M1-M5.
- Remaining: M6 rollout procedure execution + final manual production validation.

## Current State (Baseline)
- Single-focus behavior is hardcoded around `mountaineering` in mobile `Articles` and `Chat`.
- Focus table exists but lacks image/sorting/activation metadata.
- User profile does not store selected focus.
- Plans exist as `plan -> week -> day -> exercise` without explicit `phase`.
- Documents are focus-bound only; no global context scope.

## Target State
- Users store `current_focus_id` in `gym_app.profiles`.
- Focuses have title, image, ordering, active state.
- Documents support `scope = focus | global`.
- Plans support `phase` level and typed exercise configuration.
- Chat retrieval uses `current_focus_id` + global documents.
- Admin can configure focus metadata and upload scoped docs.

## Milestones

### M1 - Data Foundation
1. Add migration for:
   - focus metadata (`image_url`, `is_active`, `sort_order`)
   - profile selected focus (`current_focus_id`)
   - document scope (`scope`) with focus/global consistency constraint
   - plan phases table and week phase linkage
   - typed exercise config fields
2. Backfill existing rows:
   - assign `current_focus_id` to mountaineering/default
   - create default Phase 1 per existing plan
   - infer exercise types for legacy exercises
3. Apply migration to remote.

Deliverables:
- `supabase/migrations/20260222_001_multifocus_foundation.sql`

### M2 - Mobile Focus Selection + Scoped Reads
1. Create shared mobile hook/service:
   - load current profile focus
   - update selected focus
   - list active focuses
2. Profile:
   - show selected focus
   - add “Change Focus” screen/modal with focus cards (title + image)
3. Plan:
   - load active plan by `current_focus_id`
4. Articles:
   - load chunks from `(scope = global) OR (focus_id = current_focus_id)`
5. Chat:
   - pass `focusId = current_focus_id` (uuid)
   - fallback safely if focus missing

Acceptance:
- Switching focus updates plan/articles/chat without app reinstall.

### M3 - Admin Focus Management
1. Add Focuses admin section:
   - create/edit focus title, slug, image URL
   - activate/deactivate focus
   - reorder (sort_order)
2. Add focus picker to document upload.
3. Add global/focus context scope control for upload.

Acceptance:
- Admin can create a new focus and make it selectable in mobile.

### M4 - Context Scope + Retrieval Integration
1. Update `index-document` input payload:
   - include `scope`, optional `focusId`
2. Ensure chunks/embeddings store scope + focus metadata.
3. Update chat retrieval SQL/RPC/functions:
   - filter by global + selected focus
4. Keep telemetry/logging for retrieval source attribution.

Acceptance:
- Answers reflect selected focus and global docs.

### M5 - Plan Configuration (UI + CSV)
1. Admin plan builder model:
   - plan -> phase -> week -> day -> exercise
2. Exercise editor with type-specific fields:
   - weight lifting: sets/reps ranges
   - cardio: duration/distance/pace targets
   - stairmaster: duration/floors/pace targets
3. CSV upload + validation + apply pipeline:
   - parse, validate, show error report
   - apply transactionally

Acceptance:
- Admin can publish a complete focus plan via UI or CSV.

### M6 - QA + Rollout
1. Regression on existing mountaineering users.
2. Validate migration idempotency and backfill behavior.
3. Add smoke tests for:
   - focus switching
   - scoped docs retrieval
   - plan rendering by selected focus
4. Stage rollout with rollback strategy.

## Technical Tasks by Area

### Database
- [x] Add multi-focus schema migration.
- [x] Add `plan_phases` RLS policies (authenticated read, admin write parity if needed).
- [x] Add helpful indexes for scoped retrieval (`documents(scope, focus_id)`, chunk metadata indexes if present in embedding table).

### Mobile
- [x] Build `useCurrentFocus` hook.
- [x] Refactor `ArticlesScreen` to remove hardcoded mountaineering slug.
- [x] Refactor `ChatScreen` to use profile-selected focus.
- [x] Refactor `usePlanWeek`/`PlanHomeScreen` to resolve active plan by selected focus.
- [x] Add focus selector UI in Profile.

### Admin Web
- [x] Add focus CRUD UI.
- [x] Add focus image URL field.
- [x] Add document scope selector and focus selector.
- [x] Update document list columns to include scope.

### Edge Functions / Retrieval
- [x] Extend `index-document` payload and storage metadata.
- [x] Update retrieval query to include global + selected focus.
- [x] Add simple tests for retrieval filter logic.

## Validation Status
- [x] Admin auth E2E coverage.
- [x] Admin multi-focus/scoped-document UI smoke coverage.
- [x] Mobile focus-switching automated smoke coverage.
- [x] Retrieval filter unit/integration tests for edge functions.

## Data Contracts

### Focus
- `id`, `slug`, `name`, `image_url`, `is_active`, `sort_order`

### Profile
- `id`, `current_focus_id`, `preferred_weight_unit`, `preferred_distance_unit`

### Document
- `id`, `scope`, `focus_id?`, `title`, `source_type`, `status`

### Exercise (typed config)
- `exercise_type`: `weight_lifting | cardio | stairmaster`
- optional config:
  - `set_count`, `rep_min`, `rep_max`
  - `target_duration_min`, `target_distance`, `target_floors`, `target_pace`

## Rollout Commands

### Apply DB changes
```bash
cd /Users/joe/Reform-Codex
npx supabase db push
```

### Run mobile
```bash
cd /Users/joe/Reform-Codex/apps/mobile
npx expo start --clear --port 8083 --ios
```

### Run admin web
```bash
cd /Users/joe/Reform-Codex
npm run admin:start
```

## Risks & Mitigations
- Risk: existing users with null focus break plan/chat.
  - Mitigation: backfill `current_focus_id` + fallback to first active focus.
- Risk: retrieval pulls wrong docs across focuses.
  - Mitigation: strict scope filters and tests per focus.
- Risk: legacy exercises missing typed config.
  - Mitigation: infer type and default values; allow admin correction.

## Definition of Done
1. User can select focus and app content scopes correctly.
2. Admin can manage focuses and upload global/focus docs.
3. Chat retrieval includes global + selected focus only.
4. Plan model supports phases and typed exercise config.
5. CSV import pipeline validates and applies safely.
