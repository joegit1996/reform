# Reform

Mobile fitness planning app (Expo React Native) + Supabase backend + admin web panel.

## Monorepo Layout

- `apps/mobile`: Expo app (`Plan`, `Articles`, `Chat`, `Profile`)
- `apps/admin-web`: document management page
- `packages/shared`: markdown parsing utilities
- `supabase/migrations`: SQL schema and RLS (`gym_app` only)
- `supabase/functions/chat`: AI chat edge function
- `supabase/seed`: mountaineering seed pipeline

## Requirements

- Node 20+
- Expo CLI
- Supabase project (or local Supabase)

## Quick Start

1. Copy `.env.example` to `.env` and fill credentials.
2. Install dependencies:
   - `npm install`
3. Verify scaffold:
   - `npm run verify:all`
4. Start mobile:
   - `npm run mobile:start`
5. Start admin web:
   - `npm run admin:start`

## Admin E2E (Playwright)

- Set env vars:
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
  - optional: `E2E_BASE_URL` (defaults to `http://127.0.0.1:5174`)
- Run:
  - `npm --workspace @reform/admin-web run test:e2e`

## Supabase Notes

- All app data tables are created in schema: `gym_app`
- Apply migrations in `supabase/migrations`
- Deploy edge function from `supabase/functions/chat`
- Ensure storage bucket exists: `knowledge_docs`

## AI Chat

- Model: `qwen/qwen3-vl-235b-a22b-thinking`
- Key source:
  - local `.env`: `qwen_api_key`
  - edge runtime env: `QWEN_API_KEY` (fallback `qwen_api_key`)
