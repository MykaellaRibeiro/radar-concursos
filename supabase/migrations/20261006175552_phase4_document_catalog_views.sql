create or replace view public.prova_catalog with (security_invoker = true) as
select
  p.id,
  p.concurso_id,
  p.ano,
  p.titulo,
  p.turno,
  p.tipo,
  p.quantidade_questoes,
  p.published_at,
  p.created_at,
  c.slug as concurso_slug,
  c.titulo as concurso_titulo,
  c.uf,
  o.nome as orgao_nome,
  o.slug as orgao_slug,
  b.id as banca_id,
  b.nome as banca_nome,
  b.sigla as banca_sigla,
  b.slug as banca_slug,
  cargo.id as cargo_id,
  cargo.nome as cargo_nome,
  a.storage_bucket,
  a.storage_path,
  a.source_url,
  a.sha256,
  a.extraction_status,
  latest_gabarito.id as gabarito_id,
  latest_gabarito.tipo as gabarito_tipo,
  latest_gabarito.titulo as gabarito_titulo,
  latest_gabarito.storage_bucket as gabarito_storage_bucket,
  latest_gabarito.storage_path as gabarito_storage_path,
  latest_gabarito.source_url as gabarito_source_url,
  concat_ws(' ', p.titulo, c.titulo, o.nome, b.nome, b.sigla, cargo.nome, c.uf, p.ano::text) as search_text
from public.provas p
join public.concursos c on c.id = p.concurso_id
join public.orgaos o on o.id = c.orgao_id
left join public.bancas b on b.id = p.banca_id
left join public.cargos cargo on cargo.id = p.cargo_id
left join public.arquivos a on a.id = p.arquivo_id
left join lateral (
  select
    g.id,
    g.tipo,
    g.titulo,
    ga.storage_bucket,
    ga.storage_path,
    ga.source_url
  from public.gabaritos g
  left join public.arquivos ga on ga.id = g.arquivo_id
  where g.prova_id = p.id
  order by
    case g.tipo when 'DEFINITIVO' then 1 when 'RETIFICADO' then 2 when 'PRELIMINAR' then 3 else 4 end,
    g.published_at desc nulls last,
    g.created_at desc
  limit 1
) latest_gabarito on true;

create or replace view public.banca_catalog with (security_invoker = true) as
select
  b.id,
  b.nome,
  b.sigla,
  b.slug,
  b.site,
  count(distinct p.id) as provas_armazenadas,
  count(distinct cb.concurso_id) as concursos_relacionados,
  coalesce(array_agg(distinct p.ano order by p.ano desc) filter (where p.ano is not null), '{}'::integer[]) as anos_disponiveis
from public.bancas b
left join public.provas p on p.banca_id = b.id
left join public.concursos_bancas cb on cb.banca_id = b.id
group by b.id;

revoke all on public.prova_catalog, public.banca_catalog from anon, authenticated;
grant select on public.prova_catalog, public.banca_catalog to anon, authenticated;

comment on view public.prova_catalog is 'Read-only proof catalog without extracted text, safe for paginated public lists.';
comment on view public.banca_catalog is 'Real document and contest counts per examination board.';
