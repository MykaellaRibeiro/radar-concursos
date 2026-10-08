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

Server variables: `EXA_MCP_URL`, `EXA_API_KEY` (recommended for predicted contests), `SERPER_API_KEY` (recommended for document discovery), `DOCUMENT_SEARCH_PROVIDER`, `DISCOVERY_RESULTS_PER_QUERY`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Provider and service-role keys must never use the `NEXT_PUBLIC_` prefix.
