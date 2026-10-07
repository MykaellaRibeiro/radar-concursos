alter table public.disciplinas
  add column if not exists descricao text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.assuntos
  add column if not exists descricao text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subassuntos
  add column if not exists descricao text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.questoes
  add column if not exists tipo text not null default 'MULTIPLE_CHOICE',
  add column if not exists pagina integer,
  add column if not exists texto_bruto text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists parse_quality numeric(4,3) not null default 0,
  add column if not exists parser_version text,
  add column if not exists content_hash text,
  add column if not exists classification_status text not null default 'UNCLASSIFIED',
  add column if not exists classification_confidence public.confidence_level not null default 'LOW',
  add column if not exists disciplina_status text not null default 'UNCLASSIFIED',
  add column if not exists disciplina_confidence public.confidence_level not null default 'LOW',
  add column if not exists assunto_status text not null default 'UNCLASSIFIED',
  add column if not exists assunto_confidence public.confidence_level not null default 'LOW',
  add column if not exists subassunto_status text not null default 'UNCLASSIFIED',
  add column if not exists subassunto_confidence public.confidence_level not null default 'LOW',
  add column if not exists classifier_version text,
  add column if not exists classification_reason text,
  add column if not exists gabarito_id uuid references public.gabaritos(id) on delete set null,
  add column if not exists answer_key_verified boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_tipo_check'
      and conrelid = 'public.questoes'::regclass
  ) then
    alter table public.questoes add constraint questoes_tipo_check
      check (tipo in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'DISCURSIVE', 'OTHER'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_taxonomy_status_check'
      and conrelid = 'public.questoes'::regclass
  ) then
    alter table public.questoes add constraint questoes_taxonomy_status_check
      check (
        disciplina_status in ('UNCLASSIFIED', 'AUTO_CLASSIFIED', 'REVIEW_REQUIRED', 'REVIEWED', 'CONFIRMED')
        and assunto_status in ('UNCLASSIFIED', 'AUTO_CLASSIFIED', 'REVIEW_REQUIRED', 'REVIEWED', 'CONFIRMED')
        and subassunto_status in ('UNCLASSIFIED', 'AUTO_CLASSIFIED', 'REVIEW_REQUIRED', 'REVIEWED', 'CONFIRMED')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_pagina_check'
      and conrelid = 'public.questoes'::regclass
  ) then
    alter table public.questoes add constraint questoes_pagina_check
      check (pagina is null or pagina > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_parse_quality_check'
      and conrelid = 'public.questoes'::regclass
  ) then
    alter table public.questoes add constraint questoes_parse_quality_check
      check (parse_quality between 0 and 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_classification_status_check'
      and conrelid = 'public.questoes'::regclass
  ) then
    alter table public.questoes add constraint questoes_classification_status_check
      check (classification_status in (
        'UNCLASSIFIED', 'AUTO_CLASSIFIED', 'REVIEW_REQUIRED', 'REVIEWED', 'CONFIRMED'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_content_hash_check'
      and conrelid = 'public.questoes'::regclass
  ) then
    alter table public.questoes add constraint questoes_content_hash_check
      check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$');
  end if;
end $$;

create table if not exists public.questao_ingestoes (
  id uuid primary key default gen_random_uuid(),
  prova_id uuid not null references public.provas(id) on delete cascade,
  gabarito_id uuid references public.gabaritos(id) on delete set null,
  status text not null check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')),
  parser_version text not null,
  classifier_version text not null,
  prova_sha256 text,
  gabarito_sha256 text,
  questoes_encontradas integer not null default 0 check (questoes_encontradas >= 0),
  questoes_inseridas integer not null default 0 check (questoes_inseridas >= 0),
  questoes_atualizadas integer not null default 0 check (questoes_atualizadas >= 0),
  respostas_vinculadas integer not null default 0 check (respostas_vinculadas >= 0),
  erros jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists questoes_prova_classification_idx
  on public.questoes (prova_id, classification_status, classification_confidence);
create index if not exists questoes_disciplina_classification_idx
  on public.questoes (disciplina_id, classification_status, classification_confidence);
create index if not exists questoes_gabarito_id_idx on public.questoes (gabarito_id);
create index if not exists questoes_content_hash_idx on public.questoes (content_hash);
create index if not exists questoes_enunciado_fts_idx on public.questoes
  using gin (to_tsvector('portuguese', enunciado));
create index if not exists questao_ingestoes_prova_started_idx
  on public.questao_ingestoes (prova_id, started_at desc);
create index if not exists questao_ingestoes_gabarito_id_idx
  on public.questao_ingestoes (gabarito_id);

drop trigger if exists assuntos_set_updated_at on public.assuntos;
create trigger assuntos_set_updated_at before update on public.assuntos
for each row execute function private.set_updated_at();

drop trigger if exists subassuntos_set_updated_at on public.subassuntos;
create trigger subassuntos_set_updated_at before update on public.subassuntos
for each row execute function private.set_updated_at();

drop trigger if exists questoes_set_updated_at on public.questoes;
create trigger questoes_set_updated_at before update on public.questoes
for each row execute function private.set_updated_at();

alter table public.questao_ingestoes enable row level security;
revoke all on public.questao_ingestoes from anon, authenticated;

revoke all on public.disciplinas, public.assuntos, public.subassuntos, public.questoes from anon, authenticated;
grant select on public.disciplinas, public.assuntos, public.subassuntos, public.questoes to anon, authenticated;

create or replace view public.questao_catalog with (security_invoker = true) as
select
  q.id,
  q.prova_id,
  q.numero,
  q.tipo,
  q.pagina,
  q.enunciado,
  q.alternativa_a,
  q.alternativa_b,
  q.alternativa_c,
  q.alternativa_d,
  q.alternativa_e,
  q.resposta,
  q.anulada,
  q.parse_quality,
  q.classification_status,
  q.classification_confidence,
  q.disciplina_status,
  q.disciplina_confidence,
  q.assunto_status,
  q.assunto_confidence,
  q.subassunto_status,
  q.subassunto_confidence,
  d.id as disciplina_id,
  d.nome as disciplina_nome,
  d.slug as disciplina_slug,
  a.id as assunto_id,
  a.nome as assunto_nome,
  a.slug as assunto_slug,
  s.id as subassunto_id,
  s.nome as subassunto_nome,
  s.slug as subassunto_slug,
  p.titulo as prova_titulo,
  p.ano,
  p.source_url as prova_source_url,
  c.id as concurso_id,
  c.slug as concurso_slug,
  c.titulo as concurso_titulo,
  b.id as banca_id,
  b.slug as banca_slug,
  b.nome as banca_nome,
  cargo.id as cargo_id,
  cargo.nome as cargo_nome,
  g.id as source_gabarito_id,
  g.source_url as gabarito_source_url,
  q.created_at,
  q.updated_at
from public.questoes q
join public.provas p on p.id = q.prova_id
join public.concursos c on c.id = p.concurso_id
left join public.bancas b on b.id = p.banca_id
left join public.cargos cargo on cargo.id = p.cargo_id
left join public.gabaritos g on g.id = q.gabarito_id
left join public.disciplinas d on d.id = q.disciplina_id
left join public.assuntos a on a.id = q.assunto_id
left join public.subassuntos s on s.id = q.subassunto_id;

create or replace view public.questao_estatisticas_base with (security_invoker = true) as
select
  q.id as questao_id,
  q.prova_id,
  p.ano,
  p.concurso_id,
  c.slug as concurso_slug,
  c.titulo as concurso_titulo,
  p.banca_id,
  b.slug as banca_slug,
  b.nome as banca_nome,
  p.cargo_id,
  cargo.nome as cargo_nome,
  q.disciplina_id,
  d.slug as disciplina_slug,
  d.nome as disciplina_nome,
  q.assunto_id,
  a.slug as assunto_slug,
  a.nome as assunto_nome,
  q.subassunto_id,
  s.slug as subassunto_slug,
  s.nome as subassunto_nome,
  q.classification_status,
  q.classification_confidence,
  q.disciplina_status,
  q.disciplina_confidence,
  q.assunto_status,
  q.assunto_confidence,
  q.subassunto_status,
  q.subassunto_confidence
from public.questoes q
join public.provas p on p.id = q.prova_id
join public.concursos c on c.id = p.concurso_id
left join public.bancas b on b.id = p.banca_id
left join public.cargos cargo on cargo.id = p.cargo_id
join public.disciplinas d on d.id = q.disciplina_id
left join public.assuntos a on a.id = q.assunto_id
left join public.subassuntos s on s.id = q.subassunto_id
where q.disciplina_status = 'CONFIRMED'
   or (
     q.disciplina_status = 'AUTO_CLASSIFIED'
     and q.disciplina_confidence in ('HIGH', 'OFFICIAL')
   );

create or replace view public.estatisticas_config with (security_invoker = true) as
select 20::integer as minimum_sample_size;

create or replace view public.estatisticas_prova_disciplinas with (security_invoker = true) as
with grouped as (
  select
    prova_id, ano, concurso_id, concurso_slug, concurso_titulo,
    banca_id, banca_slug, banca_nome, cargo_id, cargo_nome,
    disciplina_id, disciplina_slug, disciplina_nome,
    count(*)::integer as question_count
  from public.questao_estatisticas_base
  group by
    prova_id, ano, concurso_id, concurso_slug, concurso_titulo,
    banca_id, banca_slug, banca_nome, cargo_id, cargo_nome,
    disciplina_id, disciplina_slug, disciplina_nome
), totals as (
  select grouped.*, sum(question_count) over (partition by prova_id)::integer as sample_size
  from grouped
)
select
  totals.*,
  round(question_count * 100.0 / nullif(sample_size, 0), 2) as percentage,
  sample_size < config.minimum_sample_size as is_small_sample
from totals cross join public.estatisticas_config config;

create or replace view public.estatisticas_prova_assuntos with (security_invoker = true) as
with grouped as (
  select
    prova_id, ano, concurso_id, concurso_slug, concurso_titulo,
    banca_id, banca_slug, banca_nome, cargo_id, cargo_nome,
    disciplina_id, disciplina_slug, disciplina_nome,
    assunto_id, assunto_slug, assunto_nome,
    count(*)::integer as question_count
  from public.questao_estatisticas_base
  where assunto_id is not null
    and (
      assunto_status = 'CONFIRMED'
      or (assunto_status = 'AUTO_CLASSIFIED' and assunto_confidence in ('HIGH', 'OFFICIAL'))
    )
  group by
    prova_id, ano, concurso_id, concurso_slug, concurso_titulo,
    banca_id, banca_slug, banca_nome, cargo_id, cargo_nome,
    disciplina_id, disciplina_slug, disciplina_nome,
    assunto_id, assunto_slug, assunto_nome
), totals as (
  select grouped.*, sum(question_count) over (partition by prova_id)::integer as sample_size
  from grouped
)
select
  totals.*,
  round(question_count * 100.0 / nullif(sample_size, 0), 2) as percentage,
  sample_size < config.minimum_sample_size as is_small_sample
from totals cross join public.estatisticas_config config;

create or replace view public.estatisticas_prova_subassuntos with (security_invoker = true) as
with grouped as (
  select
    prova_id, ano, concurso_id, concurso_slug, concurso_titulo,
    banca_id, banca_slug, banca_nome, cargo_id, cargo_nome,
    disciplina_id, disciplina_slug, disciplina_nome,
    assunto_id, assunto_slug, assunto_nome,
    subassunto_id, subassunto_slug, subassunto_nome,
    count(*)::integer as question_count
  from public.questao_estatisticas_base
  where subassunto_id is not null
    and (
      subassunto_status = 'CONFIRMED'
      or (subassunto_status = 'AUTO_CLASSIFIED' and subassunto_confidence in ('HIGH', 'OFFICIAL'))
    )
  group by
    prova_id, ano, concurso_id, concurso_slug, concurso_titulo,
    banca_id, banca_slug, banca_nome, cargo_id, cargo_nome,
    disciplina_id, disciplina_slug, disciplina_nome,
    assunto_id, assunto_slug, assunto_nome,
    subassunto_id, subassunto_slug, subassunto_nome
), totals as (
  select grouped.*, sum(question_count) over (partition by prova_id)::integer as sample_size
  from grouped
)
select
  totals.*,
  round(question_count * 100.0 / nullif(sample_size, 0), 2) as percentage,
  sample_size < config.minimum_sample_size as is_small_sample
from totals cross join public.estatisticas_config config;

revoke all on
  public.questao_catalog,
  public.questao_estatisticas_base,
  public.estatisticas_config,
  public.estatisticas_prova_disciplinas,
  public.estatisticas_prova_assuntos,
  public.estatisticas_prova_subassuntos
from anon, authenticated;

grant select on
  public.questao_catalog,
  public.questao_estatisticas_base,
  public.estatisticas_config,
  public.estatisticas_prova_disciplinas,
  public.estatisticas_prova_assuntos,
  public.estatisticas_prova_subassuntos
to anon, authenticated;

comment on table public.questao_ingestoes is 'Auditable executions of the versioned exam and answer-key parser.';
comment on column public.questoes.parse_quality is 'Deterministic parser completeness score from 0 to 1; not a factual confidence claim.';
comment on column public.questoes.classification_status is 'Workflow status for taxonomy classification and human review.';
comment on view public.questao_catalog is 'Public read-only question catalog with taxonomy and official source provenance.';
comment on view public.questao_estatisticas_base is 'Only confirmed or high-confidence automatically classified questions eligible for statistics.';
comment on view public.estatisticas_config is 'Central statistics thresholds; samples below 20 questions are explicitly flagged.';
