# Radar Concursos — relatório da Fase 3

Data da validação final: 6 de outubro de 2026  
Projeto Supabase: `kxitnwsiwefcovxdoqqv`  
Estado: **concluída com persistência real, leitura pela aplicação e idempotência comprovadas**

## Resultado executivo

A descoberta web foi integrada por interface de provider ao Exa MCP, fora das requisições da Vercel. O pipeline pesquisa, classifica eventos, relaciona órgãos e concursos, exige evidência suficiente, registra fontes e hashes, preserva o histórico em `movimentacoes` e gera notificações internas sem expor credenciais ao navegador.

Uma coleta real encontrou e persistiu o concurso 2026 da Companhia Docas do Estado da Bahia (CODEBA), com contratação do Instituto AOCP sustentada por duas fontes especializadas independentes. Uma execução posterior confirmou idempotência: nenhum concurso, movimento, vínculo de evidência, fonte ou notificação duplicado foi criado.

Durante a validação foi detectado que uma fonte mencionava 26 vagas do concurso de 2023. O extrator foi tornado conservador, o dado histórico foi removido por migration e a interface agora informa corretamente que o número de vagas de 2026 não foi divulgado.

## Migrations aplicadas

- `20261005185525_phase3_web_discovery.sql`
- `20261005192109_seed_phase3_org_aliases.sql`
- `20261006124500_correct_codeba_historical_vacancies.sql`

As migrations adicionam aliases, auditoria de descobertas, ranking de fontes, fingerprints, metadados de evidência, campos de concursos previstos e deduplicação de notificações. A última migration corrige exclusivamente o número de vagas da CODEBA 2026 e remove esse valor dos metadados do movimento.

## Coleta Exa real

### Primeira coleta persistente

- concursos criados: 1;
- órgãos criados: 1;
- movimentações criadas: 1;
- fontes novas: 2;
- evidências vinculadas: 2;
- concurso atualizado: 1;
- notificações: 0, pois não havia seguidor ou alerta compatível;
- confirmação oficial adicional: pesquisada, mas não localizada diretamente pelo provider;
- confiança atribuída: `HIGH`, nunca `OFFICIAL`.

Concurso persistido:

- título: Concurso Companhia Docas do Estado da Bahia;
- sigla: CODEBA;
- UF/região: BA / Nordeste;
- status: banca contratada;
- banca: Instituto AOCP;
- vagas: não informadas para 2026;
- movimentações: 1;
- fontes vinculadas: Folha Dirigida e JC Concursos.

### Prova final de idempotência

Coleta `937cb298-65b3-41df-851c-b6e56830e42e`:

- consultas tentadas: 4;
- resultados encontrados: 12;
- URLs únicas: 8;
- evidências aceitas: 2;
- concurso existente relacionado: 1;
- concursos criados: 0;
- movimentações criadas ou atualizadas: 0;
- concursos atualizados: 0;
- fontes ou evidências adicionadas: 0;
- notificações criadas: 0.

Uma consulta atingiu o limite gratuito do Exa MCP. As outras três foram processadas, a coleta ficou registrada como parcial e a idempotência do caso aceito foi preservada. Em produção, `EXA_API_KEY` continua recomendada para evitar o limite compartilhado.

## Contagens finais no Supabase

| Objeto | Registros |
|---|---:|
| concursos | 471 |
| órgãos | 436 |
| cargos | 2.437 |
| movimentações | 471 |
| vínculos movimentação–fonte | 472 |
| fontes | 3 |
| aliases de órgãos | 523 |
| descobertas web auditadas | 14 |
| notificações | 0 |
| coletas registradas | 8 |
| concursos em status previsto | 10 |

Os 470 concursos normalizados da Fase 2 e seus 2.437 cargos permaneceram íntegros. A Fase 3 acrescentou somente o caso CODEBA aceito.

## Auth, RLS, grants e segurança

- `auth.users`: 2 usuários existentes, ambos com e-mail confirmado; nenhum foi alterado ou excluído.
- O catálogo público em `concurso_search` é legível pela role anônima.
- `web_discoveries` permanece inacessível à role anônima; a tentativa retornou PostgreSQL `42501`.
- `orgao_aliases` e `web_discoveries` têm escrita restrita ao processo confiável com `service_role`.
- `supabase db lint --linked --level warning`: nenhum erro nos schemas `extensions`, `private` e `public`.

Os endpoints oficiais dos advisors de segurança e performance foram tentados, mas o token autenticado não possui o privilégio exigido. Não há resultado oficial de advisor a declarar. As verificações read-only disponíveis pela CLI mostraram:

- nenhuma consulta longa;
- índices centrais de concursos, cargos, fontes, movimentos e aliases presentes e usados;
- índices ainda sem uso concentrados em tabelas vazias ou recém-criadas;
- bloat pequeno: maior desperdício estimado em `public.cargos`, 248 kB, sem necessidade de manutenção neste volume.

## Interface com dados reais

Validações concluídas no navegador local com Supabase real:

- `/concursos/previstos` retornou HTTP 200 e exibiu 10 concursos previstos no recorte geral;
- o recorte `orgao=CODEBA`, `regiao=NORDESTE`, `confianca=HIGH` exibiu exatamente um resultado;
- o filtro por órgão reconhece nome jurídico e sigla;
- a linha mostra banca contratada, confiança alta, Instituto AOCP, duas fontes e vagas não informadas;
- `/concursos/concurso-companhia-docas-estado-bahia-ba-2026` retornou HTTP 200 e exibiu AOCP, a movimentação e os links das duas fontes;
- layouts inspecionados em 1440 × 900 e 390 × 844, com filtros, resumo, lista e detalhe responsivos.

## Defeitos encontrados e corrigidos

- fingerprint inicialmente dependente de banca opcional, o que permitia movimentos duplicados; a chave foi estabilizada e os duplicados de teste foram removidos;
- captura indevida das 26 vagas do certame de 2023; extração endurecida, teste de regressão criado e dado corrigido por migration;
- filtro de órgão consultava apenas o nome jurídico e não encontrava `CODEBA`; passou a considerar também a sigla;
- detalhe não usava `banca_observacao` como fallback; Instituto AOCP agora aparece na visão geral;
- truncamentos excessivos na linha de previsto foram ajustados para duas linhas e quebra segura.

Durante hot reload do servidor de desenvolvimento ocorreu uma resposta 500 transitória por JSON incompleto; a rota se recuperou na requisição seguinte. O build de produção com Turbopack foi concluído sem o erro.

## Qualidade final

- lint: aprovado, zero warnings;
- typecheck: aprovado;
- testes: 40 aprovados em 12 arquivos;
- build: aprovado com Next.js 16.3.8/Turbopack;
- páginas estáticas geradas: 18;
- testes cobrem parser Exa, rate limit, classificação, matching, ranking, confiança, fingerprint, persistência e regressão de vagas históricas.

## Decisão de conclusão

**Fase 3 concluída.** Há descoberta Exa real persistida no Supabase, evidência múltipla rastreável, histórico sem duplicação, RLS validada, segunda coleta idempotente e leitura confirmada nas páginas do Radar. Permanecem como observações operacionais o limite da instância gratuita do Exa e a falta de privilégio do token atual para os endpoints oficiais de advisors.
