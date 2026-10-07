# Relatório da Fase 5

Data da validação: 7 de outubro de 2026.

## Entrega

O piloto PC-MA 2012 — Investigador de Polícia — Tipo 1 foi processado a partir do caderno e do gabarito definitivo oficiais da FGV já armazenados no Supabase. Foram persistidas 70 questões, com 70 resultados oficiais vinculados: 68 letras e 2 anulações (38 e 67).

## Migrations

- `20261007110705_phase5_question_intelligence.sql`: metadados de parse/classificação, auditoria, índices e views públicas/estatísticas;
- `20261007111918_phase5_harden_ingestion_rls.sql`: bloqueio explícito da auditoria operacional e índices por nível;
- `20261007114500_harden_operational_rls.sql`: políticas explícitas de negação para tabelas operacionais antigas sem políticas.

Todas foram aplicadas ao projeto `kxitnwsiwefcovxdoqqv`. O lint remoto do schema terminou sem erros.

## Persistência real

| Tabela | Registros |
| --- | ---: |
| `questoes` | 70 |
| `disciplinas` | 7 |
| `assuntos` | 47 |
| `subassuntos` | 5 |
| `questao_ingestoes` | 4 |

As 70 questões têm página, hash, parser `fgv-objective-v1.0.0`, classificador `pcma-rules-v1.0.2` e vínculo verificado ao gabarito. Setenta são elegíveis por disciplina, 69 por assunto e 7 têm subassunto. A reexecução idempotente foi registrada com 70 encontradas, 0 inseridas e 0 atualizadas.

## Segurança, Auth e advisors

Leitura anônima de `questao_catalog` retornou 70 linhas com fontes oficiais. Escrita anônima em `questoes` foi bloqueada pelo PostgreSQL (`42501`). O teste de Auth criou dois usuários temporários, validou trigger de profile, login/logout, CRUD do próprio alerta, isolamento entre usuários e catálogo público; depois removeu os usuários temporários.

Permaneceram 2 usuários confirmados em `auth.users`, sem exclusão: `mykaellan@gmail.com` e `mykaella@wolfgestao.com`.

O advisor de segurança não apontou falta de RLS/policy na Fase 5. Restaram dois avisos externos ao escopo autorizado: `pg_net` instalado em `public` e proteção de senha vazada desativada no Auth. A extensão não foi movida/removida e a configuração interna do projeto não foi alterada. O advisor de performance informou 36 índices ainda não usados; são índices de um banco recém-povoado e foram preservados por sustentarem filtros, FKs, busca e crescimento futuro.

## Aplicação

Foram validadas com leitura real do Supabase as rotas `/provas/8d159a4e-c485-4cfb-8e4a-39ff79684150`, `/questoes/29e88356-5393-437a-9d98-6f711958550e`, `/estatisticas`, `/bancas/fgv` e `/concursos/policia-civil-do-maranhao-2012`. A interface exibiu as 70 questões, a anulação da questão 38, amostras `n=70`/`n=69`, rankings e fontes oficiais. O teste responsivo em 390 px não apresentou rolagem horizontal e o console do navegador não registrou erros ou avisos.

## Verificação automatizada

`npm run validate:phase5` confirmou contagens, sequência 1–70, hashes únicos, versões, anulações, elegibilidade estatística, proveniência, RLS e histórico idempotente. A prévia final do parser encontrou 70 questões e 70 respostas, vinculou todas, marcou 2 anulações, classificou 69 assuntos e 7 subassuntos, não escreveu nada e terminou sem erros.

| Gate | Resultado |
| --- | --- |
| `npm run lint` | passou, zero warnings |
| `npm run typecheck` | passou |
| `npm test` | 14 arquivos e 67 testes passaram |
| `npm run build` | passou; 18 páginas geradas e rotas dinâmicas da Fase 5 incluídas |
| `supabase db lint --linked --level warning` | passou, sem erros de schema |
| detector Impeccable | passou, zero achados |
