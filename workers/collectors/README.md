# External collectors

Heavy collectors, Playwright jobs, frequent crawls and PDF processing will run here on Railway, Render, Cloud Run, a VPS or GitHub Actions. They must call shared provider/normalization contracts and write through a trusted server connection, never during a user request on Vercel.

## Predicted contests via Exa

Validate connectivity and one real result:

```bash
npm run test:exa
```

Review candidates without writing:

```bash
npm run collect:predicted -- --dry-run
```

Persist only after reviewing the dry run:

```bash
npm run collect:predicted
```

## Documents via Serper

Collect a controlled catalog slice:

```bash
npm run collect:documents -- --max-concursos=5 --contest-offset=0 --max-files-per-contest=5 --concurrency=1
```

Backfill the complete catalog in internal batches of 50:

```bash
npm run backfill:documents -- --batch-size=50
```

Resume an interrupted backfill from a catalog offset:

```bash
npm run backfill:documents -- --batch-size=50 --start-offset=300
```

Server variables: `EXA_MCP_URL`, `EXA_API_KEY` (recommended for predicted contests), `SERPER_API_KEY` (recommended for document discovery), `DOCUMENT_SEARCH_PROVIDER`, `DISCOVERY_RESULTS_PER_QUERY`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Provider and service-role keys must never use the `NEXT_PUBLIC_` prefix.
