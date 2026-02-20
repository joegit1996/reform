# Reform App Design

**Date:** 2026-02-15
**Approach:** 1 (Monorepo with Expo mobile + separate admin web + Supabase-first backend)

## Goal
Build `Reform`, a mobile training companion focused on structured training plans, progress tracking, educational content, and AI chat grounded in uploaded documents, with a separate admin web panel for document/context management.

## Scope (v1)
- One active focus: `Mountaineering`
- Fixed imported 16-week plan from:
  - `Comprehensive Alpinism Preparation and Conditioning Plan_ Mont Blanc Ascent for the Large-Frame Athlete (1).md`
- Email/password auth (Supabase Auth)
- User-specific plan edits via copy-on-edit overrides
- Article browsing by category
- AI chat through Supabase Edge Function using model `qwen/qwen3-vl-235b-a22b-thinking`
- Admin web for document upload/list/delete and focus assignment

## Architecture
- `apps/mobile` (Expo React Native + Expo Router)
- `apps/admin-web` (React + Vite)
- `supabase/`:
  - SQL migrations
  - Edge function for chat
  - Storage buckets for uploaded docs
- Shared parser/util package for markdown training-plan and article extraction.

## Data Model (all tables in `gym_app`)
- `focuses`
- `documents`
- `document_chunks`
- `training_plans`
- `plan_weeks`
- `plan_days`
- `plan_exercises`
- `user_day_overrides`
- `user_exercise_overrides`
- `user_exercise_progress`
- `user_day_progress`
- `chat_messages`
- Optional `profiles` table for role (`admin` / `user`)

## Key Product Flows

### Plan and Progress
- Home emphasizes current week and today’s day.
- Day view is checklist-first (toggle exercises done, mark day complete).
- Users can edit day structure:
  - add/remove/edit exercises
  - change rest day status
  - add notes
- Edits stored as per-user overrides; canonical plan remains unchanged.

### Articles
- Parse non-schedule markdown sections into category-tagged article entries.
- Categories include: `Nutrition`, `Gear`, `Acclimatization`, `Recovery`, `Strength`, `Cardio`, `Safety`, `General`.
- Article list supports category filtering and clean readable formatting.

### Chat
- Mobile sends user message + focus id to edge function.
- Function composes context from:
  - focus document chunks
  - relevant plan sections
  - short recent chat history
- Calls Qwen model server-side using env key.
- Persists user and assistant messages.

### Admin Web
- Upload markdown/PDF docs.
- Assign doc to existing focus or create new focus.
- List/search/delete documents.
- Trigger/perform parsing + chunk insertion for new docs.

## Security and Access
- Supabase Auth required.
- RLS:
  - user-specific progress/overrides/messages visible only to owner.
  - canonical plan/articles readable by authenticated users.
  - admin panel mutations restricted to admin role.
- API key never exposed in mobile app.

## UX Direction
- Dark, clean, minimal mobile interface.
- Layered dark surfaces and orange accent color system.
- Clear progress signals: week progress, completion checkmarks, streak indicator.
- Navigation: `Plan`, `Articles`, `Chat`, `Profile`.

## Error Handling
- Offline-safe local state for checklist toggles with retry sync.
- Upload/parsing failures surfaced in admin status.
- Chat timeout/fallback messaging with retry.

## Testing Strategy
- Parser unit tests for week/day extraction and article categorization.
- DB migration verification for `gym_app` schema usage.
- Mobile integration checks for key flows:
  - auth
  - checklist progress
  - day overrides
  - articles
  - chat
- Admin upload/list/delete integration checks.
