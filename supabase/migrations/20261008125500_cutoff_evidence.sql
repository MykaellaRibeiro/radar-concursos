alter table public.notas_corte
  add column if not exists arquivo_id uuid references public.arquivos(id) on delete set null,
  add column if not exists fonte_id uuid references public.fontes(id) on delete set null,
  add column if not exists source_url text,
  add column if not exists published_at timestamptz,
  add column if not exists collected_at timestamptz not null default now(),
  add column if not exists confidence public.confidence_level not null default 'OFFICIAL',
  add column if not exists extraction_method text,
  add column if not exists raw_metadata jsonb not null default '{}'::jsonb;

create index if not exists notas_corte_concurso_ano_idx
  on public.notas_corte (concurso_id, ano desc, modalidade);
create index if not exists notas_corte_arquivo_id_idx
  on public.notas_corte (arquivo_id);
create index if not exists notas_corte_fonte_id_idx
  on public.notas_corte (fonte_id);

comment on table public.notas_corte is
  'Notas de corte explicitamente publicadas em documento verificável; não contém estimativas editoriais.';
comment on column public.notas_corte.raw_metadata is
  'Trecho explícito e metadados de extração usados para auditoria da nota.';
