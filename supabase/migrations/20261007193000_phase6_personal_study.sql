-- Phase 6: private study activity, bookmarks and contest targets.
-- Official answers and the public statistical corpus remain unchanged.

create table public.tentativas_questoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  alternativa_marcada char(1) not null check (alternativa_marcada in ('A', 'B', 'C', 'D', 'E')),
  correta boolean not null default false,
  anulada boolean not null default false,
  numero_tentativa integer not null default 1 check (numero_tentativa > 0),
  duracao_segundos integer check (duracao_segundos is null or duracao_segundos between 0 and 86400),
  contexto text not null default 'QUESTAO' check (contexto in ('QUESTAO', 'ESTUDO', 'PROVA', 'REVISAO')),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, questao_id, numero_tentativa)
);

create table public.questoes_salvas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, questao_id)
);

create table public.concursos_alvo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id uuid not null references public.concursos(id) on delete cascade,
  prioridade smallint not null default 1 check (prioridade between 1 and 5),
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, concurso_id)
);

create index tentativas_questoes_user_answered_idx
  on public.tentativas_questoes (user_id, answered_at desc);
create index tentativas_questoes_user_question_latest_idx
  on public.tentativas_questoes (user_id, questao_id, numero_tentativa desc);
create index tentativas_questoes_question_idx
  on public.tentativas_questoes (questao_id);
create index questoes_salvas_question_idx
  on public.questoes_salvas (questao_id);
create index concursos_alvo_concurso_idx
  on public.concursos_alvo (concurso_id);
create unique index concursos_alvo_one_primary_idx
  on public.concursos_alvo (user_id) where principal;

create function private.prepare_tentativa_questao() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user uuid;
  resposta_oficial char(1);
  questao_anulada boolean;
begin
  authenticated_user := auth.uid();
  if authenticated_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  new.user_id := authenticated_user;
  new.alternativa_marcada := upper(new.alternativa_marcada);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(authenticated_user::text || ':' || new.questao_id::text, 0)
  );

  select q.resposta, q.anulada
    into resposta_oficial, questao_anulada
  from public.questoes q
  where q.id = new.questao_id;

  if not found then
    raise exception 'question not found' using errcode = '23503';
  end if;

  new.anulada := questao_anulada;
  new.correta := not questao_anulada and resposta_oficial = new.alternativa_marcada;
  new.numero_tentativa := coalesce((
    select max(t.numero_tentativa) + 1
    from public.tentativas_questoes t
    where t.user_id = authenticated_user and t.questao_id = new.questao_id
  ), 1);
  new.answered_at := now();
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function private.prepare_tentativa_questao() from public, anon, authenticated;

create trigger tentativas_questoes_prepare
before insert on public.tentativas_questoes
for each row execute function private.prepare_tentativa_questao();

create trigger concursos_alvo_set_updated_at
before update on public.concursos_alvo
for each row execute function private.set_updated_at();

alter table public.tentativas_questoes enable row level security;
alter table public.questoes_salvas enable row level security;
alter table public.concursos_alvo enable row level security;

alter table public.tentativas_questoes force row level security;
alter table public.questoes_salvas force row level security;
alter table public.concursos_alvo force row level security;

revoke all on public.tentativas_questoes, public.questoes_salvas, public.concursos_alvo from anon, authenticated;
grant select, insert on public.tentativas_questoes to authenticated;
grant select, insert, update, delete on public.questoes_salvas, public.concursos_alvo to authenticated;

create policy "Users read own attempts" on public.tentativas_questoes
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own attempts" on public.tentativas_questoes
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Attempt history cannot be updated" on public.tentativas_questoes
for update to authenticated using (false) with check (false);
create policy "Attempt history cannot be deleted" on public.tentativas_questoes
for delete to authenticated using (false);

create policy "Users read own bookmarks" on public.questoes_salvas
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own bookmarks" on public.questoes_salvas
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own bookmarks" on public.questoes_salvas
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own bookmarks" on public.questoes_salvas
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own targets" on public.concursos_alvo
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own targets" on public.concursos_alvo
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own targets" on public.concursos_alvo
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own targets" on public.concursos_alvo
for delete to authenticated using ((select auth.uid()) = user_id);

create function public.definir_concurso_alvo(
  p_concurso_id uuid,
  p_principal boolean default true,
  p_prioridade smallint default 1
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_prioridade not between 1 and 5 then
    raise exception 'priority must be between 1 and 5' using errcode = '22023';
  end if;

  if p_principal then
    update public.concursos_alvo
      set principal = false
      where user_id = current_user_id and principal;
  end if;

  insert into public.concursos_alvo (user_id, concurso_id, prioridade, principal)
  values (current_user_id, p_concurso_id, p_prioridade, p_principal)
  on conflict (user_id, concurso_id) do update
    set prioridade = excluded.prioridade, principal = excluded.principal
  returning id into target_id;

  insert into public.concursos_seguidos (user_id, concurso_id)
  values (current_user_id, p_concurso_id)
  on conflict (user_id, concurso_id) do nothing;

  return target_id;
end;
$$;

revoke execute on function public.definir_concurso_alvo(uuid, boolean, smallint) from public, anon;
grant execute on function public.definir_concurso_alvo(uuid, boolean, smallint) to authenticated;

create or replace view public.historico_desempenho_questoes
with (security_invoker = true)
as
select
  t.id as tentativa_id,
  t.user_id,
  t.questao_id,
  t.alternativa_marcada,
  t.correta,
  t.anulada,
  t.numero_tentativa,
  t.duracao_segundos,
  t.contexto,
  t.answered_at,
  q.numero as questao_numero,
  q.enunciado,
  q.prova_id,
  q.prova_titulo,
  q.ano,
  q.concurso_id,
  q.concurso_slug,
  q.concurso_titulo,
  q.banca_id,
  q.banca_slug,
  q.banca_nome,
  q.disciplina_id,
  q.disciplina_slug,
  q.disciplina_nome,
  q.assunto_id,
  q.assunto_slug,
  q.assunto_nome,
  q.subassunto_id,
  q.subassunto_slug,
  q.subassunto_nome
from public.tentativas_questoes t
join public.questao_catalog q on q.id = t.questao_id;

create or replace view public.dominio_atual_questoes
with (security_invoker = true)
as
select ranked.*
from (
  select
    history.*,
    row_number() over (
      partition by history.user_id, history.questao_id
      order by history.numero_tentativa desc, history.answered_at desc, history.tentativa_id desc
    ) as latest_rank
  from public.historico_desempenho_questoes history
  where not history.anulada
) ranked
where ranked.latest_rank = 1;

create or replace view public.cobertura_questoes_usuario
with (security_invoker = true)
as
select distinct
  t.user_id,
  t.questao_id,
  q.disciplina_id,
  q.disciplina_slug,
  q.disciplina_nome,
  q.assunto_id,
  q.assunto_slug,
  q.assunto_nome,
  q.subassunto_id,
  q.subassunto_slug,
  q.subassunto_nome,
  q.banca_id,
  q.banca_slug,
  q.banca_nome,
  q.concurso_id,
  q.concurso_slug,
  q.concurso_titulo
from public.tentativas_questoes t
join public.questao_catalog q on q.id = t.questao_id;

revoke all on public.historico_desempenho_questoes, public.dominio_atual_questoes, public.cobertura_questoes_usuario from anon, authenticated;
grant select on public.historico_desempenho_questoes, public.dominio_atual_questoes, public.cobertura_questoes_usuario to authenticated;

comment on table public.tentativas_questoes is 'Immutable private answer history. Official correctness is derived by a trusted trigger.';
comment on view public.dominio_atual_questoes is 'Latest non-annulled attempt per user and question; distinct from full attempt history.';
comment on view public.cobertura_questoes_usuario is 'Unique questions seen by each user; annulled questions count for coverage.';
