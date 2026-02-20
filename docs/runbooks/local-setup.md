# Local Setup Runbook

## 1. Environment

Set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `qwen_api_key` (OpenRouter key)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN` (for CLI deploys)

For admin web (`apps/admin-web`), expose:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 2. Database

Apply SQL migrations in order:
1. `supabase/migrations/20260215_001_create_gym_app_schema.sql`
2. `supabase/migrations/20260216_002_rls_policies.sql`
3. `supabase/migrations/20260217_003_expose_gym_app_schema.sql`
4. `supabase/migrations/20260218_001_user_set_logs.sql`
5. `supabase/migrations/20260219_001_enable_pgvector_and_embeddings.sql`
6. `supabase/migrations/20260219_002_hybrid_retrieval_functions.sql`

Create storage bucket:
- `knowledge_docs`

## 3. Seed Initial Focus

Run:
```bash
node --loader ts-node/esm supabase/seed/run-seed.ts
```

This seeds:
- focus: `Mountaineering`
- canonical 16-week plan
- parsed article chunks

## 4. Deploy Edge Functions (Chat + Indexing)

Set secrets and deploy:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QWEN_API_KEY`
- `RAG_EMBEDDING_MODEL` (optional, default: `text-embedding-3-small`)

```bash
npx supabase secrets set QWEN_API_KEY="$qwen_api_key" --project-ref <project-ref>
npx supabase functions deploy chat --project-ref <project-ref> --no-verify-jwt
npx supabase functions deploy index-document --project-ref <project-ref> --no-verify-jwt
```

`--no-verify-jwt` is required because JWT validation happens inside each function via `auth.getUser()`.

## 5. Run Apps

Mobile:
```bash
npm run mobile:start
```

Admin:
```bash
npm run admin:start
```

Upload flow:
- Admin uploads a markdown/pdf file.
- PDF text is extracted in the admin web app before saving the document row.
- Document row starts in `processing`.
- `index-document` chunks text, generates embeddings, and writes to `gym_app.document_chunks` + `gym_app.document_embeddings`.
- If PDF text is missing, `index-document` uses a lightweight server fallback extractor.
- Status becomes `ready` when indexing completes.
