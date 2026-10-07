select jsonb_build_object(
  'counts', jsonb_build_object(
    'concursos', (select count(*) from public.concursos),
    'editais', (select count(*) from public.editais),
    'provas', (select count(*) from public.provas),
    'gabaritos', (select count(*) from public.gabaritos),
    'arquivos', (select count(*) from public.arquivos),
    'resultados', (select count(*) from public.resultados)
  ),
  'documents', (
    select jsonb_agg(to_jsonb(document_row) order by document_row.tipo, document_row.titulo)
    from (
      select
        a.id,
        a.tipo,
        a.titulo,
        a.storage_bucket,
        a.storage_path,
        a.mime_type,
        a.file_size,
        a.sha256,
        a.extraction_status,
        a.extraction_method,
        a.page_count,
        length(a.texto_extraido) as extracted_characters,
        a.source_url,
        c.slug as concurso_slug
      from public.arquivos a
      join public.concursos c on c.id = a.concurso_id
    ) document_row
  ),
  'bucket', (
    select to_jsonb(bucket_row)
    from (
      select id, name, public, file_size_limit, allowed_mime_types
      from storage.buckets
      where id = 'radar-documentos'
    ) bucket_row
  ),
  'stored_objects', (
    select jsonb_build_object(
      'count', count(*),
      'paths', jsonb_agg(name order by name)
    )
    from storage.objects
    where bucket_id = 'radar-documentos'
  ),
  'rls', (
    select jsonb_agg(to_jsonb(rls_row) order by rls_row.table_name)
    from (
      select c.relname as table_name, c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ('arquivos', 'editais', 'provas', 'gabaritos', 'resultados')
    ) rls_row
  ),
  'policies', (
    select jsonb_agg(to_jsonb(policy_row) order by policy_row.schemaname, policy_row.tablename, policy_row.policyname)
    from (
      select schemaname, tablename, policyname, roles, cmd, qual, with_check
      from pg_policies
      where (schemaname = 'public' and tablename in ('arquivos', 'editais', 'provas', 'gabaritos', 'resultados'))
         or (schemaname = 'storage' and tablename = 'objects')
    ) policy_row
  ),
  'view_grants', (
    select jsonb_agg(to_jsonb(grant_row) order by grant_row.table_name, grant_row.grantee, grant_row.privilege_type)
    from (
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('prova_catalog', 'banca_catalog')
        and grantee in ('anon', 'authenticated')
    ) grant_row
  ),
  'recent_collections', (
    select jsonb_agg(to_jsonb(collection_row) order by collection_row.started_at desc)
    from (
      select id, provider, status, started_at, completed_at, items_found, items_created, items_updated, errors
      from public.coletas
      where provider = 'document_collector'
      order by started_at desc
      limit 3
    ) collection_row
  )
) as phase4_validation;
