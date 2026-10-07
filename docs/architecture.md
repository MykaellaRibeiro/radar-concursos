# Arquitetura

## Fluxos principais

`Browser → Next.js/Vercel → Supabase Auth + PostgreSQL`

`Worker → PCI provider → MCP Streamable HTTP → normalização → Supabase`

`Worker → SearchProvider → Exa MCP → extração → matching → evidências → Supabase`

`Worker → fonte oficial revisada → download validado → SHA-256 → Storage → metadata + texto → Supabase`

`Worker → PDF oficial persistido → parser versionado → gabarito → classificador conservador → questões + taxonomia → views estatísticas`

`Usuário autenticado → Server Action → RLS + trigger de correção → histórico privado → views de domínio/cobertura → prioridade determinística`

`GitHub Actions → worker independente → lock PostgreSQL com TTL → provider → Supabase → collector_health`

Server Components consultam o catálogo público; Server Actions tratam autenticação e mutações de usuário. O proxy do Next.js renova cookies e protege rotas privadas. Dados externos nunca são coletados durante uma request do usuário.

## Camadas

- `src/app`: rotas, layouts, Route Handlers e composição de telas.
- `src/components`: UI reutilizável sem integração externa.
- `src/features`: regras e casos de uso por domínio.
- `src/lib/supabase`: clientes browser, servidor e admin separados.
- `src/lib/providers`: contratos e adapters de fontes externas.
- `workers`: collectors e processos pesados implantáveis fora da Vercel.

## Princípios

Cada fato conserva sua fonte e nível de confiança. Mudanças de status criam uma `movimentacao`; o estado atual do concurso é apenas o ponteiro mais recente. Providers retornam um formato canônico e nunca gravam diretamente a partir de componentes.

O `PciConcursosProvider` é server-side e transforma o payload externo em `NormalizedContest`. O collector é o único responsável por persistir catálogo, relações de cargos, evidências, movimentações e `coletas`. Componentes React e requests de usuários nunca chamam o MCP.

O `ExaSearchProvider` implementa um contrato desacoplado do fornecedor. O `WebDiscoveryCollector` executa poucas queries agregadas, classifica os resultados com regras determinísticas e só cria um concurso novo quando há fonte oficial ou duas fontes fortes independentes. O PCI e a descoberta web permanecem providers e collectors independentes.

O `DocumentCollector` permanece independente do PCI e da descoberta web. A lista piloto é uma manifestação revisada; `SearchProvider` pode sugerir candidatos, mas nenhum resultado de busca é persistido automaticamente. Downloads, parsing de PDF e upload ficam em `workers/`. O PostgreSQL armazena relações, hashes, versões, origem, estado de extração e texto normalizado; o binário fica no Storage.

O pipeline de questões começa somente depois que prova e gabarito foram validados pela ingestão documental. `workers/questions/ingest-exam.ts` coordena os parsers FGV, o `RuleBasedQuestionClassifier`, o upsert e o registro de auditoria. Ele não roda em Server Components, Route Handlers nem funções da Vercel. Parser, classificador, hashes e resultado de cada execução ficam persistidos para reprocessamento auditável.

`prova_catalog`, `banca_catalog`, `questao_catalog` e as views estatísticas usam `security_invoker=true`. Elas atendem leitura pública explícita; tabelas operacionais continuam fechadas. A leitura detalhada também usa selects explícitos, e o browser nunca recebe a service role.

As tabelas pessoais da Fase 6 são `tentativas_questoes`, `questoes_salvas` e `concursos_alvo`. `concursos_seguidos` foi reutilizada em vez de duplicada. Tentativas são imutáveis: o trigger `private.prepare_tentativa_questao` deriva usuário, correção, estado anulado e número da tentativa no banco. Bookmarks e alvos possuem unicidade por usuário e objeto; `definir_concurso_alvo` troca o alvo principal e acompanha o concurso na mesma transação.

`historico_desempenho_questoes`, `dominio_atual_questoes` e `cobertura_questoes_usuario` usam `security_invoker=true` e dependem da RLS das tabelas de origem. Agregações e prioridades são executadas em Server Components; o navegador não recebe o histórico completo nem compartilha cache de dados pessoais. Sessões persistidas de estudo não foram criadas nesta fase porque não eram necessárias para resolver, medir e revisar questões sem agregar estado redundante.

`event_fingerprint` agrupa o mesmo órgão, evento e fatos relevantes dentro de uma janela temporal. Uma confirmação posterior adiciona evidência ao movimento existente e pode elevar sua confiança; não cria uma linha concorrente. O ranking de status impede regressões automáticas.

Mocks não são fallback automático: só existem em desenvolvimento com `ENABLE_DEVELOPMENT_MOCKS=true`. Na operação normal, ausência de registros produz estado vazio.

## Autenticação e privilégios

`@supabase/ssr` compartilha a sessão por cookies. Rotas privadas são verificadas no proxy com claims validados, e o layout resolve o usuário no servidor. Políticas RLS continuam sendo a fronteira de autorização, mesmo quando a interface já protege a rota.

O collector utiliza `SUPABASE_SERVICE_ROLE_KEY` fora do browser. Esse privilégio não substitui RLS para usuários e não é importado por Client Components.

## Operação de produção

A aplicação web usa o runtime padrão Next.js da Vercel. GitHub Actions é o executor escolhido para os três collectors porque os scripts já são processos independentes e não exigem infraestrutura residente. Cada workflow tem concorrência própria e cada collector também adquire um lock no PostgreSQL; a proteção do banco continua válida mesmo quando a execução não parte do GitHub.

`private.collector_locks` guarda proprietário, heartbeat e expiração. As RPCs de início, heartbeat e término aceitam somente `service_role`. Uma execução abandonada perde o lock após o TTL; uma segunda execução ativa retorna `already_running`. `public.collector_health` é uma visão `security_invoker` acessível apenas ao backend privilegiado.

O endpoint `/api/health` testa apenas aplicação e alcance do banco. Ele não chama providers, não executa jobs e não revela URLs ou chaves internas. Falhas de PCI, Exa ou documentos ficam isoladas dos requests da aplicação.
