alter table public.concursos
  add column provider text,
  add column external_id text,
  add column deduplication_key text,
  add column raw_metadata jsonb not null default '{}'::jsonb;

alter table public.concurso_fontes
  add column raw_metadata jsonb not null default '{}'::jsonb;

alter table public.concursos
  add constraint concursos_provider_external_id_key unique (provider, external_id),
  add constraint concursos_deduplication_key_key unique (deduplication_key);

create index concursos_registration_deadline_idx
  on public.concursos (fim_inscricoes)
  where fim_inscricoes is not null;

comment on column public.concursos.raw_metadata is 'Payload bruto da fonte, preservado apenas para auditoria e evolução do parser.';
comment on column public.concursos.deduplication_key is 'SHA-256 determinístico do conjunto normalizado usado para deduplicação entre coletas.';
