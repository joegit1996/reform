# Reform Multi-Focus Rollout Checklist

## Purpose
Operational checklist for safely rolling out multi-focus functionality to production.

## Preconditions
- [ ] Supabase project access is confirmed (SQL Editor + Edge Functions + Storage).
- [ ] `.env` values are present and valid for production deployment.
- [ ] Admin account is available and has `admin` role in `gym_app.profiles`.

## 1. Preflight Validation
- [x] Confirm local build passes:
  - [x] `npm --workspace @reform/admin-web run build`
- [ ] Confirm admin E2E passes:
  - [x] `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm --workspace @reform/admin-web run test:e2e` (executed; 3 tests skipped in this environment)
- [ ] Confirm mobile app launches and can reach Supabase.
- [ ] Confirm chat function has required secrets (`QWEN_API_KEY` set).

## 2. Database Deployment
- [ ] Run migration push:
  - [ ] `npx supabase db push`
- [ ] Verify schema changes:
  - [ ] `gym_app.focuses` contains `image_url`, `is_active`, `sort_order`.
  - [ ] `gym_app.profiles` contains `current_focus_id`.
  - [ ] `gym_app.documents` contains `scope` and consistency constraint.
  - [ ] `gym_app.plan_phases` exists and has RLS policies.
  - [ ] Typed plan exercise fields exist.
- [ ] Verify indexes:
  - [ ] `idx_documents_scope_focus_status` exists.
  - [ ] Multi-focus migration indexes exist.

## 3. Edge Functions Deployment
- [ ] Deploy `index-document`:
  - [ ] `npx supabase functions deploy index-document --project-ref <ref>`
- [ ] Deploy `chat`:
  - [ ] `npx supabase functions deploy chat --project-ref <ref>`
- [ ] Smoke-call chat endpoint with valid auth token and focus context.

## 4. Admin Rollout Validation
- [ ] Sign in to admin web.
- [ ] Create a new focus with image.
- [ ] Confirm focus appears in focus list and plan builder focus selector.
- [ ] Upload one `focus` scoped document and one `global` scoped document.
- [ ] Reindex document and verify status changes `processing -> ready`.
- [ ] Confirm document table filtering by scope/status works.

## 5. Mobile Rollout Validation
- [ ] Open app and sign in.
- [ ] Profile: change focus and confirm selected focus persists.
- [ ] Plan tab updates for selected focus.
- [ ] Articles tab reflects global + selected focus content.
- [ ] Chat responds with selected focus context.

## 6. Post-Deploy Monitoring (First 24h)
- [ ] Track edge function error rates (`chat`, `index-document`).
- [ ] Track document indexing failures (`status = error`) and investigate.
- [ ] Validate no spike in auth/RLS denials.
- [ ] Validate admin operations (focus create/edit, document upload, plan edits).

## Execution Log (2026-02-19)
- `npm run verify:all` passed (`verify:workspace`, `verify:schema`).
- `npm --workspace @reform/admin-web run build` passed.
- `npm --workspace @reform/admin-web run test:e2e` executed; all 3 tests skipped due environment data/auth gating.
- Automated tests added and passing:
  - `npx -y tsx --test supabase/functions/chat/retrieval.test.ts`
  - `npx -y tsx --test apps/mobile/src/features/focus/focusScope.test.ts`

## 7. Rollback Plan
- [ ] If edge behavior regresses, redeploy last known-good function versions.
- [ ] Disable new focus usage operationally:
  - [ ] set non-critical focuses `is_active = false`.
- [ ] Stop new document ingestion if indexing pipeline is unstable.
- [ ] Communicate rollback status and impacted features.

## Exit Criteria
- [ ] All preflight and deploy checks pass.
- [ ] Admin and mobile validations pass.
- [ ] No critical errors in first 24h monitoring window.
