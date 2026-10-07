# Banco de dados

O schema está em `supabase/migrations`. UUIDs são as chaves primárias. Datas de fatos usam `date`/`timestamptz`; valores monetários usam `numeric`.

## Núcleos relacionais

- Catálogo: `orgaos`, `concursos`, `cargos`, `concursos_cargos`, `bancas`, `concursos_bancas`.
- Evidência: `fontes`, `concurso_fontes`, `movimentacoes`, `movimentacao_fontes`.
- Documentos e estudo: `editais`, `provas`, `gabaritos`, `questoes`, `disciplinas`, `assuntos`, `subassuntos`, `arquivos`.
- Resultados: `inscricoes`, `concorrencia`, `resultados`, `notas_corte`.
- Usuário: `profiles`, `alertas`, `concursos_seguidos`, `notificacoes`.
- Operação: `coletas`, `search_logs`, `web_discoveries`, `questao_ingestoes`.

`candidatos_por_vaga` é uma coluna gerada por `inscritos / vagas`, evitando inconsistência manual.

## Segurança

Todas as tabelas públicas têm RLS. O catálogo concede apenas `SELECT` a `anon` e `authenticated`; escrita exige backend confiável. Perfis, alertas, concursos seguidos e notificações usam políticas por `(select auth.uid())`. Colunas filtradas por RLS têm índices próprios.

Não use `user_metadata` para autorização. O trigger de criação de perfil usa metadata somente como nome de exibição, nunca como permissão.

As views `questao_catalog`, `questao_estatisticas_base`, `estatisticas_prova_disciplinas`, `estatisticas_prova_assuntos` e `estatisticas_prova_subassuntos` usam `security_invoker=true`. Browser roles recebem somente `SELECT`. Escritas em questões, taxonomia e auditoria de ingestão são exclusivas de processos confiáveis.

`questoes` preserva texto estruturado e bruto, alternativas, página, tipo, hash, versões de parser/classificador, qualidade de parse, vínculo ao gabarito e estados/confianças independentes para disciplina, assunto e subassunto. A chave lógica permanece `(prova_id, numero)` e o hash permite detectar mudança real de conteúdo.
