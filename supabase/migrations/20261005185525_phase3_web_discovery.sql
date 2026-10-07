-- Phase 3: evidence-backed web discovery for predicted contests.
-- This migration is deliberately additive so Phase 2 catalog data remains intact.

alter table public.fontes
  add column ranking_tier text not null default 'OTHER'
    check (ranking_tier in ('OFFICIAL','EXAM_BOARD','SPECIALIZED_HIGH','SPECIALIZED','NEWS','OTHER'));

update public.fontes
set ranking_tier = case tipo
  when 'OFFICIAL' then 'OFFICIAL'
  when 'EXAM_BOARD' then 'EXAM_BOARD'
  when 'SPECIALIZED' then 'SPECIALIZED'
  when 'NEWS' then 'NEWS'
  else 'OTHER'
end;

alter table public.concursos
  add column vagas_previstas integer check (vagas_previstas is null or vagas_previstas >= 0),
  add column data_prevista_precision text not null default 'UNKNOWN'
    check (data_prevista_precision in ('EXACT','MONTH','QUARTER','YEAR','UNKNOWN')),
  add column banca_status text
    check (banca_status is null or banca_status in ('PROVAVEL','DEFINIDA','CONTRATADA')),
  add column banca_observacao text;

alter table public.movimentacoes
  add column event_fingerprint text,
  add column occurred_at timestamptz,
  add column metadata jsonb not null default '{}'::jsonb;

create unique index movimentacoes_event_fingerprint_uidx
  on public.movimentacoes(event_fingerprint)
  where event_fingerprint is not null;

create index movimentacoes_occurred_at_idx
  on public.movimentacoes(concurso_id, occurred_at desc nulls last);

alter table public.movimentacao_fontes
  add column titulo text,
  add column published_at timestamptz,
  add column content_hash text,
  add column confidence public.confidence_level not null default 'LOW',
  add column metadata jsonb not null default '{}'::jsonb;

alter table public.notificacoes add column deduplication_key text;
create unique index notificacoes_deduplication_key_uidx
  on public.notificacoes(deduplication_key)
  where deduplication_key is not null;

create table public.orgao_aliases (
  id uuid primary key default gen_random_uuid(),
  orgao_id uuid not null references public.orgaos(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'DISCOVERY',
  created_at timestamptz not null default now(),
  unique (orgao_id, normalized_alias)
);

create index orgao_aliases_normalized_alias_idx
  on public.orgao_aliases(normalized_alias);

create table public.web_discoveries (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  query text not null,
  title text not null,
  url text not null,
  domain text not null,
  snippet text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  content_hash text not null,
  status text not null default 'DISCOVERED'
    check (status in ('DISCOVERED','ACCEPTED','REJECTED','PERSISTED')),
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique (provider, url, content_hash)
);

create index web_discoveries_status_retrieved_idx
  on public.web_discoveries(status, retrieved_at desc);
create index web_discoveries_domain_idx on public.web_discoveries(domain);

alter table public.orgao_aliases enable row level security;
alter table public.web_discoveries enable row level security;

-- Operational discovery data is server-only. The service role still needs
-- explicit table privileges even though it bypasses RLS.
revoke all on public.orgao_aliases, public.web_discoveries from public, anon, authenticated;
grant select, insert, update, delete on public.orgao_aliases, public.web_discoveries to service_role;
grant usage, select on all sequences in schema public to service_role;

comment on table public.web_discoveries is
  'Minimal discovery audit trail; stores metadata and short snippets, never full copied articles.';
comment on column public.movimentacoes.event_fingerprint is
  'Stable digest used to make event ingestion idempotent across collector runs.';

create or replace view public.concurso_search with (security_invoker = true) as
select
  c.id, c.slug, c.titulo, c.status, c.confidence, c.uf, c.cidade, c.regiao,
  c.vagas_total, c.salario_min, c.salario_max, c.escolaridade_resumo, c.fim_inscricoes,
  c.created_at, c.updated_at, o.nome as orgao_nome, o.sigla as orgao_sigla,
  coalesce((select string_agg(distinct cargo.nome, ' ') from public.concursos_cargos cc join public.cargos cargo on cargo.id = cc.cargo_id where cc.concurso_id = c.id), '') as cargos,
  coalesce((select string_agg(distinct cargo.area, ' ') from public.concursos_cargos cc join public.cargos cargo on cargo.id = cc.cargo_id where cc.concurso_id = c.id), '') as areas,
  coalesce((select string_agg(distinct b.nome, ' ') from public.concursos_bancas cb join public.bancas b on b.id = cb.banca_id where cb.concurso_id = c.id), '') as bancas,
  concat_ws(' ', c.titulo, o.nome, o.sigla, c.uf, c.cidade,
    (select string_agg(distinct cargo.nome, ' ') from public.concursos_cargos cc join public.cargos cargo on cargo.id = cc.cargo_id where cc.concurso_id = c.id),
    (select string_agg(distinct cargo.area, ' ') from public.concursos_cargos cc join public.cargos cargo on cargo.id = cc.cargo_id where cc.concurso_id = c.id),
    (select string_agg(distinct b.nome, ' ') from public.concursos_bancas cb join public.bancas b on b.id = cb.banca_id where cb.concurso_id = c.id)
  ) as search_text,
  c.vagas_previstas,
  c.data_prevista,
  c.data_prevista_precision,
  c.banca_status,
  c.banca_observacao,
  lm.titulo as latest_movement_title,
  lm.event_date as latest_movement_date,
  lm.occurred_at as latest_movement_at,
  coalesce(sc.source_count, 0)::integer as source_count,
  pb.primary_board
from public.concursos c
join public.orgaos o on o.id = c.orgao_id
left join lateral (
  select m.titulo, m.event_date, m.occurred_at
  from public.movimentacoes m
  where m.concurso_id = c.id
  order by coalesce(m.occurred_at, m.event_date::timestamptz) desc, m.created_at desc
  limit 1
) lm on true
left join lateral (
  select count(distinct mf.url) as source_count
  from public.movimentacoes m
  join public.movimentacao_fontes mf on mf.movimentacao_id = m.id
  where m.concurso_id = c.id
) sc on true
left join lateral (
  select b.nome as primary_board
  from public.concursos_bancas cb
  join public.bancas b on b.id = cb.banca_id
  where cb.concurso_id = c.id
  order by cb.is_primary desc, cb.created_at desc
  limit 1
) pb on true;

revoke all on table public.concurso_search from public;
grant select on table public.concurso_search to anon, authenticated, service_role;
