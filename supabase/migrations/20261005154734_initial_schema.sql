create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.concurso_status as enum (
  'SOLICITADO','ANUNCIADO','PREVISTO','AUTORIZADO','COMISSAO_FORMADA','BANCA_EM_DEFINICAO',
  'BANCA_DEFINIDA','BANCA_CONTRATADA','EDITAL_EM_ELABORACAO','EDITAL_IMINENTE','EDITAL_PUBLICADO',
  'INSCRICOES_ABERTAS','INSCRICOES_ENCERRADAS','PROVA_MARCADA','PROVA_REALIZADA','GABARITO_PUBLICADO',
  'RESULTADO_PRELIMINAR','RESULTADO_DEFINITIVO','HOMOLOGADO','CONVOCACAO','ENCERRADO'
);
create type public.confidence_level as enum ('LOW','MEDIUM','HIGH','OFFICIAL');
create type public.orgao_tipo as enum ('POLICIA_CIVIL','POLICIA_MILITAR','TRIBUNAL','PREFEITURA','SECRETARIA','UNIVERSIDADE','AUTARQUIA','MINISTERIO_PUBLICO','DEFENSORIA','OUTRO');
create type public.fonte_tipo as enum ('OFFICIAL','SPECIALIZED','NEWS','EXAM_BOARD','SEARCH_ENGINE','OTHER');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, nome, avatar_url)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'nome', ''), nullif(split_part(email, '@', 1), ''), 'Usuario'),
  raw_user_meta_data ->> 'avatar_url'
from auth.users;

create table public.orgaos (
  id uuid primary key default gen_random_uuid(), nome text not null, sigla text, slug text not null unique,
  tipo public.orgao_tipo not null default 'OUTRO', uf char(2), cidade text, site_oficial text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cargos (
  id uuid primary key default gen_random_uuid(), nome text not null, slug text not null unique, area text,
  escolaridade text, descricao text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.bancas (
  id uuid primary key default gen_random_uuid(), nome text not null, sigla text, slug text not null unique,
  site text, descricao text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.concursos (
  id uuid primary key default gen_random_uuid(), slug text not null unique, titulo text not null,
  orgao_id uuid not null references public.orgaos(id) on delete restrict,
  status public.concurso_status not null default 'PREVISTO', confidence public.confidence_level not null default 'LOW',
  uf char(2), cidade text, regiao text, descricao text, vagas_total integer check (vagas_total is null or vagas_total >= 0),
  salario_min numeric(12,2) check (salario_min is null or salario_min >= 0),
  salario_max numeric(12,2) check (salario_max is null or salario_max >= 0), escolaridade_resumo text,
  data_prevista date, data_edital date, inicio_inscricoes date, fim_inscricoes date, data_prova date, official_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (salario_min is null or salario_max is null or salario_max >= salario_min),
  check (inicio_inscricoes is null or fim_inscricoes is null or fim_inscricoes >= inicio_inscricoes)
);

create table public.concursos_cargos (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  cargo_id uuid not null references public.cargos(id) on delete restrict, vagas integer check (vagas is null or vagas >= 0),
  cadastro_reserva boolean not null default false, salario_inicial numeric(12,2), salario_final numeric(12,2),
  carga_horaria integer, taxa_inscricao numeric(10,2), created_at timestamptz not null default now(),
  unique (concurso_id, cargo_id)
);

create table public.concursos_bancas (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  banca_id uuid not null references public.bancas(id) on delete restrict, is_primary boolean not null default false,
  created_at timestamptz not null default now(), unique (concurso_id, banca_id)
);

create table public.editais (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  banca_id uuid references public.bancas(id) on delete set null, tipo text, numero text, ano integer, titulo text not null,
  url_original text not null, storage_path text, texto_extraido text, published_at timestamptz, created_at timestamptz not null default now(),
  hash text, unique (concurso_id, hash)
);

create table public.provas (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  banca_id uuid references public.bancas(id) on delete set null, cargo_id uuid references public.cargos(id) on delete set null,
  ano integer, titulo text not null, url_original text, storage_path text, quantidade_questoes integer check (quantidade_questoes is null or quantidade_questoes >= 0),
  created_at timestamptz not null default now()
);

create table public.gabaritos (
  id uuid primary key default gen_random_uuid(), prova_id uuid not null references public.provas(id) on delete cascade,
  titulo text not null, url_original text, storage_path text, published_at timestamptz, created_at timestamptz not null default now()
);

create table public.disciplinas (
  id uuid primary key default gen_random_uuid(), nome text not null unique, slug text not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.assuntos (
  id uuid primary key default gen_random_uuid(), disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  nome text not null, slug text not null, created_at timestamptz not null default now(), unique (disciplina_id, slug)
);
create table public.subassuntos (
  id uuid primary key default gen_random_uuid(), assunto_id uuid not null references public.assuntos(id) on delete cascade,
  nome text not null, slug text not null, created_at timestamptz not null default now(), unique (assunto_id, slug)
);
create table public.questoes (
  id uuid primary key default gen_random_uuid(), prova_id uuid not null references public.provas(id) on delete cascade,
  numero integer not null, disciplina_id uuid references public.disciplinas(id) on delete set null,
  assunto_id uuid references public.assuntos(id) on delete set null, subassunto_id uuid references public.subassuntos(id) on delete set null,
  enunciado text not null, alternativa_a text, alternativa_b text, alternativa_c text, alternativa_d text, alternativa_e text,
  resposta char(1) check (resposta is null or resposta in ('A','B','C','D','E')), anulada boolean not null default false,
  created_at timestamptz not null default now(), unique (prova_id, numero)
);

create table public.fontes (
  id uuid primary key default gen_random_uuid(), nome text not null, dominio text not null, tipo public.fonte_tipo not null,
  official boolean not null default false, reliability_score numeric(4,3) check (reliability_score between 0 and 1),
  created_at timestamptz not null default now(), unique (dominio, tipo)
);
create table public.concurso_fontes (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  fonte_id uuid not null references public.fontes(id) on delete restrict, url text not null, titulo text,
  published_at timestamptz, collected_at timestamptz not null default now(), content_hash text,
  confidence public.confidence_level not null default 'LOW', is_primary boolean not null default false,
  unique nulls not distinct (concurso_id, url, content_hash)
);
create table public.movimentacoes (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  tipo text not null, titulo text not null, descricao text, status_anterior public.concurso_status,
  status_novo public.concurso_status, event_date date not null, confidence public.confidence_level not null default 'LOW',
  created_at timestamptz not null default now()
);
create table public.movimentacao_fontes (
  id uuid primary key default gen_random_uuid(), movimentacao_id uuid not null references public.movimentacoes(id) on delete cascade,
  fonte_id uuid not null references public.fontes(id) on delete restrict, url text not null, created_at timestamptz not null default now(),
  unique (movimentacao_id, url)
);

create table public.inscricoes (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  cargo_id uuid references public.cargos(id) on delete set null, total_inscritos integer not null check (total_inscritos >= 0),
  fonte_id uuid references public.fontes(id) on delete set null, published_at timestamptz, unique (concurso_id, cargo_id, published_at)
);
create table public.concorrencia (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  cargo_id uuid references public.cargos(id) on delete set null, vagas integer not null check (vagas >= 0),
  inscritos integer not null check (inscritos >= 0), candidatos_por_vaga numeric generated always as (case when vagas > 0 then inscritos::numeric / vagas else null end) stored,
  ano integer, created_at timestamptz not null default now(), unique (concurso_id, cargo_id, ano)
);
create table public.resultados (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  cargo_id uuid references public.cargos(id) on delete set null, tipo text not null, url text not null, published_at timestamptz
);
create table public.notas_corte (
  id uuid primary key default gen_random_uuid(), concurso_id uuid not null references public.concursos(id) on delete cascade,
  cargo_id uuid references public.cargos(id) on delete set null, modalidade text not null, nota numeric not null,
  classificacao integer, ano integer, unique (concurso_id, cargo_id, modalidade, ano)
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null, active boolean not null default true, regiao text, uf char(2), cidade text,
  orgao_id uuid references public.orgaos(id) on delete set null, cargo_id uuid references public.cargos(id) on delete set null,
  area text, escolaridade text, salario_min numeric(12,2), banca_id uuid references public.bancas(id) on delete set null,
  status_filter public.concurso_status[], created_at timestamptz not null default now()
);
create table public.concursos_seguidos (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  concurso_id uuid not null references public.concursos(id) on delete cascade, created_at timestamptz not null default now(),
  unique (user_id, concurso_id)
);
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  concurso_id uuid references public.concursos(id) on delete cascade, movimentacao_id uuid references public.movimentacoes(id) on delete cascade,
  titulo text not null, mensagem text not null, read boolean not null default false, created_at timestamptz not null default now()
);

create table public.coletas (
  id uuid primary key default gen_random_uuid(), provider text not null, started_at timestamptz not null,
  finished_at timestamptz, status text not null check (status in ('RUNNING','SUCCESS','FAILED','PARTIAL')),
  items_found integer not null default 0, items_created integer not null default 0, items_updated integer not null default 0,
  error_message text, metadata jsonb not null default '{}'::jsonb
);
create table public.arquivos (
  id uuid primary key default gen_random_uuid(), concurso_id uuid references public.concursos(id) on delete cascade,
  tipo text not null, storage_path text not null unique, source_url text, hash text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.search_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  provider text not null, query text not null, results_count integer not null default 0, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index concursos_orgao_id_idx on public.concursos(orgao_id);
create index concursos_status_updated_idx on public.concursos(status, updated_at desc);
create index concursos_location_idx on public.concursos(uf, cidade);
create index movimentacoes_concurso_date_idx on public.movimentacoes(concurso_id, event_date desc);
create index alertas_user_id_idx on public.alertas(user_id);
create index concursos_seguidos_user_id_idx on public.concursos_seguidos(user_id);
create index notificacoes_user_id_idx on public.notificacoes(user_id);
create index search_logs_user_id_idx on public.search_logs(user_id);

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger orgaos_set_updated_at before update on public.orgaos for each row execute function private.set_updated_at();
create trigger cargos_set_updated_at before update on public.cargos for each row execute function private.set_updated_at();
create trigger bancas_set_updated_at before update on public.bancas for each row execute function private.set_updated_at();
create trigger concursos_set_updated_at before update on public.concursos for each row execute function private.set_updated_at();
create trigger disciplinas_set_updated_at before update on public.disciplinas for each row execute function private.set_updated_at();

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nome, avatar_url)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end; $$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','orgaos','cargos','bancas','concursos','concursos_cargos','concursos_bancas','editais','provas','gabaritos','disciplinas','assuntos','subassuntos','questoes','fontes','concurso_fontes','movimentacoes','movimentacao_fontes','inscricoes','concorrencia','resultados','notas_corte','alertas','concursos_seguidos','notificacoes','coletas','arquivos','search_logs']
  loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.orgaos, public.cargos, public.bancas, public.concursos, public.concursos_cargos,
  public.concursos_bancas, public.editais, public.provas, public.gabaritos, public.disciplinas, public.assuntos,
  public.subassuntos, public.questoes, public.fontes, public.concurso_fontes, public.movimentacoes,
  public.movimentacao_fontes, public.inscricoes, public.concorrencia, public.resultados, public.notas_corte,
  public.arquivos to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.alertas, public.concursos_seguidos to authenticated;
grant select, update, delete on public.notificacoes to authenticated;

do $$ declare table_name text; begin
  foreach table_name in array array['orgaos','cargos','bancas','concursos','concursos_cargos','concursos_bancas','editais','provas','gabaritos','disciplinas','assuntos','subassuntos','questoes','fontes','concurso_fontes','movimentacoes','movimentacao_fontes','inscricoes','concorrencia','resultados','notas_corte','arquivos']
  loop execute format('create policy "Public read %s" on public.%I for select to anon, authenticated using (true)', table_name, table_name); end loop;
end $$;

create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users read own alerts" on public.alertas for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own alerts" on public.alertas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own alerts" on public.alertas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own alerts" on public.alertas for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own follows" on public.concursos_seguidos for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own follows" on public.concursos_seguidos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own follows" on public.concursos_seguidos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own follows" on public.concursos_seguidos for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own notifications" on public.notificacoes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users update own notifications" on public.notificacoes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own notifications" on public.notificacoes for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.profiles force row level security;
alter table public.alertas force row level security;
alter table public.concursos_seguidos force row level security;
alter table public.notificacoes force row level security;

create view public.concurso_search with (security_invoker = true) as
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
  ) as search_text
from public.concursos c
join public.orgaos o on o.id = c.orgao_id;

grant select on public.concurso_search to anon, authenticated;
