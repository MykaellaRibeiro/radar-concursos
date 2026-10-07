-- Seed only deterministic aliases already present in the Radar catalog.
with aliases as (
  select id as orgao_id, nome as alias from public.orgaos
  union all
  select id, sigla from public.orgaos where sigla is not null and char_length(trim(sigla)) >= 2
), normalized as (
  select
    orgao_id,
    trim(alias) as alias,
    trim(regexp_replace(lower(translate(
      alias,
      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
      'AAAAEEEIIIOOOOUUUCaaaaeeeiiioooouuuc'
    )), '[^a-z0-9]+', ' ', 'g')) as normalized_alias
  from aliases
)
insert into public.orgao_aliases (orgao_id, alias, normalized_alias, source)
select orgao_id, alias, normalized_alias, 'CATALOG'
from normalized
where normalized_alias <> ''
on conflict (orgao_id, normalized_alias) do nothing;
