# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**LLM & AI:**
- OpenRouter (https://openrouter.ai/api/v1) - Hosted LLM API for Qwen models
  - Service: Qwen AI model access (qwen3-vl-235b-a22b-thinking)
  - SDK/Client: HTTP fetch
  - Auth: `QWEN_API_KEY` or `qwen_api_key` environment variable
  - Used in:
    - `supabase/functions/chat/index.ts` - Chat completions and embeddings
    - `supabase/functions/analyze-meal/index.ts` - Meal image analysis with vision
    - `supabase/functions/index-document/index.ts` - Document embedding generation

**Chat & Completions:**
- OpenRouter Chat Completions endpoint - For conversational AI
  - Model: `qwen/qwen3-vl-235b-a22b-thinking`
  - Temperature: 0.3 (for chat), 0.2 (for meal analysis)
  - Used in `supabase/functions/chat/index.ts` (lines 172-183)

**Embeddings:**
- OpenRouter Embeddings endpoint - For semantic search
  - Model: `text-embedding-3-small` (configurable via `RAG_EMBEDDING_MODEL` env var)
  - Used in:
    - `supabase/functions/chat/index.ts` (lines 10-23) - Query embeddings for RAG
    - `supabase/functions/index-document/index.ts` (lines 69-88) - Document chunk embeddings

**Vision/Image Analysis:**
- OpenRouter Vision API - Integrated into Qwen model
  - Accepts base64-encoded images
  - Used in `supabase/functions/analyze-meal/index.ts` (lines 124-127) for food recognition

## Data Storage

**Databases:**
- Supabase PostgreSQL - Primary application database
  - Connection: `SUPABASE_URL` (Supabase project URL)
  - Client: @supabase/supabase-js 2.49.1
  - Schema: `gym_app` - Application-specific schema (not public)
  - Extensions enabled:
    - pgcrypto - UUID generation and crypto functions
    - pgvector - Vector similarity search for embeddings
  - Key tables:
    - `gym_app.profiles` - User profile data
    - `gym_app.focuses` - Training focus definitions
    - `gym_app.documents` - Knowledge base documents (markdown/PDF)
    - `gym_app.document_chunks` - Chunked document content for RAG
    - `gym_app.document_embeddings` - Vector embeddings for semantic search
    - `gym_app.chat_messages` - Conversation history per user/focus
    - `gym_app.training_plans` - Training programs
    - `gym_app.plan_weeks` - Weekly training phases
    - `gym_app.plan_days` - Daily workout protocols
    - `gym_app.plan_exercises` - Exercise definitions
    - `gym_app.user_meals` - Logged meals with macros
    - `gym_app.user_meal_items` - Individual food items in meals
    - `gym_app.user_nutrition_profiles` - User nutrition targets

**File Storage:**
- Supabase Storage - Document and image storage
  - Bucket: `knowledge_docs` - Knowledge base PDFs and documents
  - Used in `supabase/functions/index-document/index.ts` (line 180) for PDF download
  - Used in `apps/admin-web/src/components/DocumentUpload.tsx` - Document upload from web UI

**Caching:**
- None detected in current implementation

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Authentication and session management
  - Implementation: Supabase built-in auth
  - Session storage: Supabase client maintains session tokens
  - OAuth support via Expo Auth Session (`expo-auth-session`)
  - Used in:
    - `apps/mobile/src/lib/supabase.ts` - Supabase client initialization
    - `apps/admin-web/src/lib/supabase.ts` - Admin auth
    - `apps/mobile/src/features/chat/ChatScreen.tsx` (lines 56-75) - Session management
    - `supabase/functions/chat/index.ts` (lines 40-50) - Auth verification for functions

**Authorization:**
- Supabase RLS (Row Level Security) - Database-level access control
  - Role-based: `user` and `admin` roles in profiles table
  - Focus-scoped: Data filtering by focus_id for plan customization
  - User-scoped: Data isolation per user_id
  - Admin bypass: Service role key for administrative functions
  - Policies defined in `supabase/migrations/20260216_002_rls_policies.sql`

## Monitoring & Observability

**Error Tracking:**
- None detected (console.warn used sparingly in `supabase/functions/analyze-meal/index.ts`)

**Logs:**
- Console logging (Deno runtime for functions)
- Error responses returned to clients with message details
- No centralized logging service detected

## CI/CD & Deployment

**Hosting:**
- Supabase Cloud - Managed PostgreSQL and Edge Functions
  - Functions deployed as Supabase Edge Functions (Deno runtime)
  - Database hosted on Supabase infrastructure

**Mobile Deployment:**
- Expo - For iOS/Android builds and distribution
  - Managed build service available

**Web Deployment:**
- Not explicitly configured - Vite SPA ready for deployment to any static host

**CI Pipeline:**
- Playwright tests configured in `apps/admin-web/playwright.config.ts`
- E2E tests runnable locally with CI adjustments (retries, workers)
- No GitHub Actions or automated CI/CD detected

## Environment Configuration

**Required env vars:**
- `SUPABASE_URL` - Supabase project endpoint
- `SUPABASE_ANON_KEY` - Public API key for client-side auth
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side admin key for Edge Functions
- `QWEN_API_KEY` or `qwen_api_key` - OpenRouter API key for LLM
- `RAG_EMBEDDING_MODEL` (optional) - Embedding model (defaults to text-embedding-3-small)
- `EXPO_PUBLIC_SUPABASE_URL` - Public key for mobile (Expo requires EXPO_PUBLIC_ prefix)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Mobile auth key
- `E2E_ADMIN_EMAIL` (dev/test only) - Admin account for E2E tests
- `E2E_ADMIN_PASSWORD` (dev/test only) - Admin password for E2E tests
- `E2E_BASE_URL` (optional) - E2E test server URL (default: http://127.0.0.1:5174)

**Secrets location:**
- `.env` file at project root (not committed, see .gitignore)
- Supabase dashboard project settings for hosted secrets

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (functions are pull-based via client invocation via `supabase.functions.invoke()`)

## Cross-Function Communication

**Supabase Edge Functions:**
- `supabase/functions/chat/index.ts` - Chat endpoint
  - Invoked from: `apps/mobile/src/features/chat/ChatScreen.tsx` (line 77)
  - Input: `{ focusId: string | null, message: string }`
  - Output: `{ reply: string, citations: Array<{index, chunkId, documentId, title, category}> }`
  - Dependencies: OpenRouter API, Supabase database, embedding generation

- `supabase/functions/analyze-meal/index.ts` - Meal image analysis
  - Invoked from: Mobile nutrition logging (not directly visible but defined for this purpose)
  - Input: `{ imageBase64: string, mimeType: string, note: string }`
  - Output: `{ components: MealItem[], totals: { protein_g, carbs_g, fats_g, calories } }`
  - Dependencies: OpenRouter Vision API, Supabase auth (optional)

- `supabase/functions/index-document/index.ts` - Document indexing for RAG
  - Invoked from: `apps/admin-web/src/components/DocumentUpload.tsx` (implied)
  - Input: `{ documentId: string }`
  - Output: `{ ok: true, documentId, chunkCount, embeddingCount, model }`
  - Dependencies: OpenRouter embeddings, Supabase storage, PDF processing
  - Processing: PDF text extraction, document chunking, vector embedding generation

## Data Flow Architecture

**RAG Pipeline (Retrieval Augmented Generation):**
1. Admin uploads document via admin-web
2. `index-document` function extracts text and chunks document
3. Chunks embedded via OpenRouter embedding API
4. Embeddings stored in `document_embeddings` table with pgvector
5. User sends chat message in mobile app
6. `chat` function executes hybrid retrieval:
   - Lexical search: Full-text matching via `lexical_document_chunks()` RPC
   - Vector search: Semantic matching via `match_document_chunks()` RPC with pgvector
7. Results merged and ranked, top 8 chunks selected
8. Qwen model generates response with context and citations
9. Both message and response stored in `chat_messages` table

**Meal Analysis Pipeline:**
1. User captures meal photo in mobile app
2. Image sent as base64 to `analyze-meal` function
3. OpenRouter Qwen vision model analyzes image
4. Function returns structured meal components and macro totals
5. Mobile app stores meal in `user_meals` and `user_meal_items` tables

---

*Integration audit: 2026-02-20*
