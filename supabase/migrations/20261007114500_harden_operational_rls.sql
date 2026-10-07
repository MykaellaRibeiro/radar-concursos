-- Operational tables are server-only. Explicit deny policies document that
-- browser roles must not read or mutate collector and discovery internals.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'coletas',
    'orgao_aliases',
    'search_logs',
    'web_discoveries'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', relation_name || '_browser_deny', relation_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      relation_name || '_browser_deny',
      relation_name
    );
  end loop;
end
$$;
