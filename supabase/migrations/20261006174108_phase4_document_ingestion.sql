-- Phase 4: document metadata, extraction state and one bounded public bucket.
-- Binary files remain in Storage; PostgreSQL keeps evidence and relationships only.

alter table public.arquivos
  add column titulo text,
  add column fonte_id uuid references public.fontes(id) on delete set null,
  add column storage_bucket text not null default 'radar-documentos',
  add column mime_type text,
  add column file_size bigint,
  add column sha256 text,
  add column published_at timestamptz,
  add column downloaded_at timestamptz,
  add column extraction_status text not null default 'PENDING',
  add column extraction_method text,
  add column extraction_error text,
  add column texto_extraido text,
  add column page_count integer,
  add column version integer not null default 1,
  add column supersedes_id uuid references public.arquivos(id) on delete set null,
  add column updated_at timestamptz not null default now();

update public.arquivos set sha256 = hash where sha256 is null and hash is not null;

alter table public.editais
  add column arquivo_id uuid references public.arquivos(id) on delete restrict,
  add column source_url text,
  add column storage_bucket text,
  add column sha256 text,
  add column version integer not null default 1,
  add column supersedes_id uuid references public.editais(id) on delete set null,
  add column updated_at timestamptz not null default now();

update public.editais
set source_url = url_original,
    sha256 = hash,
    storage_bucket = case when storage_path is null then null else 'radar-documentos' end
where source_url is null;

alter table public.provas
  add column arquivo_id uuid references public.arquivos(id) on delete restrict,
  add column turno text,
  add column tipo text,
  add column source_url text,
  add column storage_bucket text,
  add column sha256 text,
  add column texto_extraido text,
  add column published_at timestamptz,
  add column version integer not null default 1,
  add column supersedes_id uuid references public.provas(id) on delete set null,
  add column updated_at timestamptz not null default now();

update public.provas set source_url = url_original where source_url is null;

alter table public.gabaritos
  add column arquivo_id uuid references public.arquivos(id) on delete restrict,
  add column tipo text not null default 'DEFINITIVO',
  add column source_url text,
  add column storage_bucket text,
  add column sha256 text,
  add column texto_extraido text,
  add column version integer not null default 1,
  add column supersedes_id uuid references public.gabaritos(id) on delete set null,
  add column updated_at timestamptz not null default now();

update public.gabaritos set source_url = url_original where source_url is null;

alter table public.resultados
  add column arquivo_id uuid references public.arquivos(id) on delete restrict,
  add column titulo text,
  add column storage_bucket text,
  add column storage_path text,
  add column sha256 text,
  add column updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'arquivos_tipo_check' and conrelid = 'public.arquivos'::regclass) then
    alter table public.arquivos add constraint arquivos_tipo_check check (tipo in (
      'EDITAL', 'RETIFICACAO', 'PROVA', 'GABARITO', 'RESULTADO', 'CONCORRENCIA',
      'COMUNICADO', 'PORTARIA', 'CONTRATO_BANCA', 'OUTRO'
    ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'arquivos_extraction_status_check' and conrelid = 'public.arquivos'::regclass) then
    alter table public.arquivos add constraint arquivos_extraction_status_check check (
      extraction_status in ('PENDING', 'TEXT', 'PARTIAL', 'SCANNED', 'FAILED', 'NOT_APPLICABLE')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'arquivos_file_size_check' and conrelid = 'public.arquivos'::regclass) then
    alter table public.arquivos add constraint arquivos_file_size_check check (file_size is null or file_size >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'arquivos_page_count_check' and conrelid = 'public.arquivos'::regclass) then
    alter table public.arquivos add constraint arquivos_page_count_check check (page_count is null or page_count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'arquivos_version_check' and conrelid = 'public.arquivos'::regclass) then
    alter table public.arquivos add constraint arquivos_version_check check (version > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'arquivos_sha256_check' and conrelid = 'public.arquivos'::regclass) then
    alter table public.arquivos add constraint arquivos_sha256_check check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'editais_tipo_check' and conrelid = 'public.editais'::regclass) then
    alter table public.editais add constraint editais_tipo_check check (tipo is null or tipo in ('ABERTURA', 'RETIFICACAO', 'CONVOCACAO', 'RESULTADO', 'OUTRO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gabaritos_tipo_check' and conrelid = 'public.gabaritos'::regclass) then
    alter table public.gabaritos add constraint gabaritos_tipo_check check (tipo in ('PRELIMINAR', 'DEFINITIVO', 'RETIFICADO', 'OUTRO'));
  end if;
end $$;

create unique index if not exists arquivos_sha256_uidx on public.arquivos(sha256) where sha256 is not null;
create index if not exists arquivos_concurso_tipo_idx on public.arquivos(concurso_id, tipo, created_at desc);
create index if not exists arquivos_fonte_id_idx on public.arquivos(fonte_id);
create index if not exists arquivos_supersedes_id_idx on public.arquivos(supersedes_id);
create index if not exists editais_concurso_published_idx on public.editais(concurso_id, published_at desc);
create index if not exists editais_arquivo_id_idx on public.editais(arquivo_id);
create index if not exists editais_banca_id_idx on public.editais(banca_id);
create index if not exists editais_supersedes_id_idx on public.editais(supersedes_id);
create index if not exists provas_concurso_ano_idx on public.provas(concurso_id, ano desc, created_at desc);
create unique index if not exists provas_concurso_arquivo_uidx on public.provas(concurso_id, arquivo_id) where arquivo_id is not null;
create index if not exists provas_arquivo_id_idx on public.provas(arquivo_id);
create index if not exists provas_banca_id_idx on public.provas(banca_id);
create index if not exists provas_cargo_id_idx on public.provas(cargo_id);
create index if not exists provas_supersedes_id_idx on public.provas(supersedes_id);
create index if not exists gabaritos_prova_published_idx on public.gabaritos(prova_id, published_at desc);
create unique index if not exists gabaritos_prova_arquivo_uidx on public.gabaritos(prova_id, arquivo_id) where arquivo_id is not null;
create index if not exists gabaritos_arquivo_id_idx on public.gabaritos(arquivo_id);
create index if not exists gabaritos_supersedes_id_idx on public.gabaritos(supersedes_id);
create index if not exists resultados_arquivo_id_idx on public.resultados(arquivo_id);
create index if not exists resultados_concurso_id_idx on public.resultados(concurso_id);
create index if not exists resultados_cargo_id_idx on public.resultados(cargo_id);

create index if not exists arquivos_texto_extraido_fts_idx on public.arquivos
using gin (to_tsvector('portuguese', coalesce(texto_extraido, '')));

create trigger arquivos_set_updated_at before update on public.arquivos
for each row execute function private.set_updated_at();
create trigger editais_set_updated_at before update on public.editais
for each row execute function private.set_updated_at();
create trigger provas_set_updated_at before update on public.provas
for each row execute function private.set_updated_at();
create trigger gabaritos_set_updated_at before update on public.gabaritos
for each row execute function private.set_updated_at();
create trigger resultados_set_updated_at before update on public.resultados
for each row execute function private.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radar-documentos', 'radar-documentos', true, 20971520, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.arquivos is 'Validated document blobs stored in Supabase Storage, deduplicated by SHA-256.';
comment on column public.arquivos.texto_extraido is 'Normalized text extracted from a validated PDF; never contains binary or base64.';
comment on column public.arquivos.supersedes_id is 'Previous file version when a known source URL changes content.';
comment on column public.arquivos.storage_path is 'Immutable content-addressed path generated from SHA-256.';
