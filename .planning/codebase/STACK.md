# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript - Full codebase (web apps, mobile, shared packages, Supabase functions)
- SQL - Database migrations and schema definitions

**Secondary:**
- JavaScript - Module imports and configuration
- Deno - Supabase Edge Function runtime

## Runtime

**Environment:**
- Node.js v24.1.0
- Deno (for Supabase Edge Functions)

**Package Manager:**
- Yarn 1.22.22
- Lockfile: Present (yarn.lock)

**Framework Ecosystem:**
- Monorepo structure with workspaces: `apps/` (admin-web, mobile) and `packages/` (shared)

## Frameworks

**Core:**
- React 19.1.0 (web) / 19.0.0 (admin-web) - UI component library
- React Native 0.81.5 - Native mobile development
- Expo 54 - React Native development framework

**Routing & Navigation:**
- Expo Router 6.0.23 - Mobile app navigation
- React Router (implicit in admin-web) - Web routing via Vite

**Build/Dev:**
- Vite 6.1.0 - Web bundler and dev server (`apps/admin-web/vite.config.ts`)
- Expo CLI - Mobile development
- @vitejs/plugin-react 4.3.4 - React support in Vite

**Testing:**
- @playwright/test 1.58.2 - E2E testing (`apps/admin-web/playwright.config.ts`)

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.49.1 - PostgreSQL database client and auth (used in `apps/mobile/src/lib/supabase.ts`, `apps/admin-web/src/lib/supabase.ts`)
- pg 8.18.0 - PostgreSQL driver in root dependencies
- @ungap/structured-clone 1.3.0 - Polyfill for structured clone

**Mobile UI:**
- react-native-screens 4.16.0 - Navigation component library
- react-native-safe-area-context 5.6.0 - Safe area handling
- react-native-reanimated 4.2.2 - Animation library
- react-native-svg 15.15.3 - SVG rendering
- expo-image-picker 17.0.10 - Image selection from device
- expo-haptics 15.0.8 - Haptic feedback
- expo-blur 15.0.8 - Blur effects
- expo-status-bar 3.0.9 - Status bar control
- expo-web-browser 15.0.10 - Web browser integration
- expo-auth-session 7.0.10 - OAuth session handling

**Icons & UI:**
- @expo/vector-icons 15.0.3 - Icon library
- @fortawesome/fontawesome-svg-core 6.7.2 - FontAwesome icons
- @fortawesome/free-solid-svg-icons 7.2.0 - FontAwesome solid icon set
- @fortawesome/react-native-fontawesome 0.3.2 - FontAwesome for React Native

**Document Processing:**
- pdfjs-dist 4.10.38 - PDF parsing and rendering (used in admin-web for document uploads)

**Development Tools:**
- TypeScript 5.6.3 - Type checking
- @types/react 18.3.12 - React type definitions
- @types/react-dom 18.3.1 - React DOM type definitions
- babel-plugin-transform-inline-environment-variables 0.4.4 - Environment variable inlining for mobile

## Configuration

**Environment:**
- `.env` file present - Contains environment configuration (secrets not shown)
- `.env.example` - Template showing required variables:
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_ANON_KEY` - Public Supabase API key
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
  - `qwen_api_key` - Qwen LLM API key (OpenRouter)
  - `EXPO_PUBLIC_SUPABASE_URL` - Public Supabase URL for mobile (prefixed for Expo)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Public key for mobile
  - `E2E_ADMIN_EMAIL` - E2E test admin email
  - `E2E_ADMIN_PASSWORD` - E2E test admin password
  - `E2E_BASE_URL` - E2E test base URL (default: http://127.0.0.1:5174)

**TypeScript Configuration:**
- Root `tsconfig.json` extends Expo base config
- Workspace apps have their own TypeScript setups

**Build Configuration:**
- `apps/admin-web/vite.config.ts` - Vite config with React plugin
- `apps/admin-web/playwright.config.ts` - E2E test configuration:
  - Default base URL: http://127.0.0.1:5174
  - Browser: Chromium
  - Web server spawn: `npm run dev -- --host 127.0.0.1 --port 5174`
  - Parallel test execution enabled
  - Screenshots/videos on failure

## Platform Requirements

**Development:**
- Node.js 24.1.0+
- Yarn 1.22.22
- iOS simulator or Android emulator for mobile testing
- Modern browser for admin-web development

**Production:**
- Mobile: iOS 12+ / Android 8+
- Web: Modern browser with ES2020 support
- Backend: Supabase PostgreSQL instance

**Deployment Targets:**
- iOS (via Expo)
- Android (via Expo)
- Web (Vite SPA)

---

*Stack analysis: 2026-02-20*
