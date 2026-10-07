# Radar Concursos — Relatório da Fase 2

Data da validação: 05/10/2026  
Projeto Supabase: `kxitnwsiwefcovxdoqqv`

## Resultado

A limpeza controlada do schema `public`, a implantação do schema do Radar, a coleta real do PCI, a persistência e a leitura pela aplicação foram concluídas e verificadas. Os schemas internos do Supabase, extensões e usuários existentes em `auth.users` foram preservados.

## Inventário anterior à limpeza

Tabelas encontradas em `public` (12):

- `areas`
- `cp_attempts`
- `cp_daily_sessions`
- `cp_learning_units`
- `cp_news_items`
- `cp_profiles`
- `cp_progress`
- `media_items`
- `profiles`
- `tasks`
- `time_entries`
- `whatsapp_messages`

Views: nenhuma.

Funções públicas encontradas (12):

- `_productivity_report(uuid,date,date)`
- `complete_task(uuid)`
- `fmt_seconds(integer)`
- `get_productivity_report(date,date)`
- `handle_new_user()`
- `meuhub_tz()`
- `reclassify_inbox_item(uuid,uuid)`
- `reopen_task(uuid)`
- `seed_default_areas()`
- `set_updated_at()`
- `start_timer(uuid)`
- `stop_timer()`

Triggers relevantes:

- `auth.users.on_auth_user_created` → `public.handle_new_user`
- `public.media_items.trg_set_updated_at`
- `public.tasks.trg_set_updated_at`

Também existiam 36 policies vinculadas às tabelas antigas. Não havia sequences públicas.

## Limpeza realizada

Foram removidas as 12 tabelas antigas, as 12 funções públicas antigas, os três triggers antigos e as policies/grants dependentes. A estrutura e os registros antigos de `public.profiles` foram descartados; a tabela foi recriada com o modelo do Radar. O inventário posterior confirmou que nenhum dos objetos de tabela legados permaneceu em `public`.

Não foram alterados schemas internos. O job interno `cron.codepulse-daily-news-8am-fortaleza` e entradas antigas do Vault foram preservados porque ficam fora de `public` e a autorização proibiu alterações em schemas/configurações internas. A extensão `pg_net`, instalada em `public` pela infraestrutura existente, também foi preservada.

## Migrations aplicadas

Histórico local e remoto sincronizado:

- `20260922152028`
- `20260922152401`
- `20260922154202`
- `20260922162459`
- `20261005150000_cleanup_legacy_public`
- `20261005154734_initial_schema`
- `20261005170700_pci_collection_metadata`
- `20261005175441_harden_concurso_search_grants`
- `20261005175604_index_radar_foreign_keys`

As quatro migrations históricas de 22/09 foram mantidas como marcadores compatíveis com o histórico remoto, sem recriar o CodePulse em ambientes novos.

## Schema final do Radar

Tabelas criadas em `public` (28):

- `alertas`, `arquivos`, `assuntos`, `bancas`, `cargos`, `coletas`, `concorrencia`
- `concurso_fontes`, `concursos`, `concursos_bancas`, `concursos_cargos`, `concursos_seguidos`
- `disciplinas`, `editais`, `fontes`, `gabaritos`, `inscricoes`
- `movimentacao_fontes`, `movimentacoes`, `notas_corte`, `notificacoes`, `orgaos`
- `profiles`, `provas`, `questoes`, `resultados`, `search_logs`, `subassuntos`

View: `concurso_search`, com `security_invoker = true`.

Todas as 28 tabelas estão com RLS ativado. `profiles`, `alertas`, `concursos_seguidos` e `notificacoes` também usam RLS forçado. Há 35 policies. As funções operacionais ficam no schema privado `private`; não restou função no schema `public`.

Grants validados:

- `anon` e `authenticated`: somente leitura do catálogo público e da view de busca.
- `authenticated`: operações próprias em alertas e concursos seguidos; leitura/atualização do próprio profile; leitura/atualização/exclusão das próprias notificações.
- Sem acesso do browser a `coletas` e `search_logs`.
- Sem leitura anônima de `profiles` e sem escrita anônima no catálogo.

## Dados persistidos

Contagens finais das tabelas principais:

| Tabela | Registros |
|---|---:|
| `profiles` | 2 |
| `orgaos` | 435 |
| `cargos` | 2.437 |
| `bancas` | 0 |
| `concursos` | 470 |
| `concursos_cargos` | 6.232 |
| `fontes` | 1 |
| `concurso_fontes` | 470 |
| `movimentacoes` | 470 |
| `movimentacao_fontes` | 470 |
| `coletas` | 3 |
| `alertas` | 0 |
| `concursos_seguidos` | 0 |
| `notificacoes` | 0 |

Status dos concursos: 461 `INSCRICOES_ABERTAS` e 9 `PREVISTO`.

## Estado de Auth

Os dois usuários anteriores de `auth.users` foram preservados e receberam profiles compatíveis com o Radar:

- `mykaella@wolfgestao.com` — id `f16821d0-5c45-4d1d-a406-cd4686ad5652`
- `mykaellan@gmail.com` — id `8bddbbec-3a03-46dc-9853-6d411ab26606`

Nenhum usuário antigo foi apagado. Dois usuários temporários foram criados exclusivamente para o teste automatizado e removidos ao final; o inventário final voltou a registrar somente os dois usuários acima.

Validação Auth + RLS concluída:

- provisionamento, login com senha, sessão e logout: OK;
- trigger `auth.users` → `private.handle_new_user` e criação de profile: OK;
- catálogo anônimo: 470 concursos;
- leitura anônima de profiles: bloqueada;
- escrita anônima no catálogo: bloqueada;
- CRUD do próprio alerta: permitido;
- leitura e atualização do alerta de outro usuário: bloqueadas.

## Coleta PCI real

Transporte: MCP Streamable HTTP em `https://mcp.pciconcursos.com.br/mcp`.

| Execução | Encontrados | Normalizados | Descartados | Únicos | Criados | Atualizados | Inalterados | Estado |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 470 | 470 | 9 | 461 | 461 | 0 | 0 | SUCCESS |
| 2 | 470 | 470 | 0 | 470 | 9 | 0 | 461 | SUCCESS |
| 3 | 470 | 470 | 0 | 470 | 0 | 0 | 470 | SUCCESS |

A terceira execução comprovou idempotência. Total final: 470 concursos persistidos, nenhum erro de coleta.

## Advisors e lint de banco

Security Advisor:

- nenhuma tabela exposta sem RLS;
- nenhuma view insegura ou função `SECURITY DEFINER` pública;
- INFO para `coletas` e `search_logs` sem policies — comportamento intencional, pois são tabelas server-only e sem grants para browser;
- WARN para `pg_net` no schema `public` — preservado por ser extensão existente e por não haver autorização para mover/remover extensões;
- WARN para proteção contra senhas vazadas desativada — configuração interna do Auth não foi alterada.

Performance Advisor:

- os 25 foreign keys inicialmente sem índice foram corrigidos;
- restaram apenas INFOs de índices ainda não utilizados, esperado em um schema recém-criado sem histórico de tráfego.

Database lint: `No schema errors found` para `public` e `private`.

## Validação da aplicação

Leitura real confirmada no navegador:

- `/concursos/previstos`: 9 registros reais exibidos;
- `/concursos/abertos`: registros reais exibidos, com limite visual de 50 por página;
- `/concursos?q=Transpetro`: busca aplicada no banco antes da paginação e resultado encontrado;
- `/concursos/transpetro-petrobras-transporte-s-a-br-294365`: detalhe carregado com status, remuneração, período, 62 cargos, movimentação e fonte PCI;
- `/dashboard`: usuário anônimo redirecionado para `/login?next=%2Fdashboard`, conforme esperado;
- viewport de 375 px: layout renderizado; drawer móvel prendeu o foco, fechou com Escape e devolveu o foco ao gatilho;
- todas as rotas verificadas retornaram HTTP 200 após o servidor ser reiniciado com acesso ao Supabase.

## Gates de qualidade

- Lint da aplicação: passou, zero warnings.
- Typecheck: passou.
- Testes: 5 arquivos, 16 testes, todos aprovados.
- Build: passou com Next.js 16.3.8; 18 páginas geradas/verificadas.

## Erros encontrados durante a operação

- Um script inicial de validação usava top-level await incompatível com a saída CommonJS; foi encapsulado em função assíncrona antes de tocar no banco.
- O domínio reservado `example.com` foi rejeitado pelo Auth; o teste foi alterado para provisionamento administrativo sem envio de e-mail.
- Advisors disparados em paralelo invalidaram a mesma credencial temporária da CLI; foram repetidos sequencialmente com sucesso.
- O primeiro servidor local estava sem acesso de rede e recebeu `EACCES`; foi reiniciado com acesso permitido, e todas as rotas passaram.
- Uma coluna de diagnóstico foi consultada na view de catálogo errada; a consulta final foi corrigida para `pg_class`.

Nenhum desses erros deixou dados temporários, usuários de teste ou alterações parciais no banco.
