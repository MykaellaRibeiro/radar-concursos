-- The two accepted 2026 sources state that the new vacancy count is not yet
-- defined. The value 26 belongs to the 2023 exam cited as historical context.
update public.concursos
set vagas_previstas = null
where slug = 'concurso-companhia-docas-estado-bahia-ba-2026'
  and provider = 'web_discovery';

update public.movimentacoes
set metadata = metadata - 'vacancies'
where concurso_id = (
  select id
  from public.concursos
  where slug = 'concurso-companhia-docas-estado-bahia-ba-2026'
)
  and tipo = 'BANCA_CONTRATADA'
  and metadata ->> 'provider' = 'exa';
