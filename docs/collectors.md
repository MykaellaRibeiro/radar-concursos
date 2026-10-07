# Collectors

## Pipeline

`provider → normalização → deduplicação → órgão → concurso → fonte → movimentação → alertas`

Cada execução registra início, fim, status, itens encontrados, criados, atualizados e erro. O collector calcula hash antes de gravar; mudança de hash gera evidência nova e, quando pertinente, uma movimentação.

## Execução PCI

```bash
npm run check:pci
npm run collect:pci
```

`check:pci` descobre as ferramentas e executa uma consulta real sem tocar no banco. `collect:pci` requer `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente server-side. Cada chamada externa possui timeout de 45 segundos e até duas novas tentativas com backoff curto.

O endpoint é MCP, não REST improvisado. O collector abre uma sessão Streamable HTTP, faz uma chamada ampla a `listar_concursos`, fecha a sessão e só então trabalha localmente. Não há scraping HTML nem uma chamada por concurso.

## Idempotência e histórico

Cada concurso conserva `provider`, `external_id` e uma `deduplication_key` SHA-256 formada por órgão, UF, título, cargos, URL e datas. Restrições únicas no banco tornam o upsert idempotente. Órgãos, cargos, relações e evidências também usam conflitos explícitos.

Antes do update, o collector compara prazo, remuneração, vagas e status. Mudanças relevantes geram uma `movimentacao` com fonte; execuções sem mudança não criam novo histórico.

## Normalização

- UF aceita sigla ou nome e termina no padrão de duas letras.
- Região é inferida da UF e usa `NORTE`, `NORDESTE`, `CENTRO_OESTE`, `SUDESTE`, `SUL` ou `NACIONAL`.
- Valores brasileiros como `R$ 10.428,05` viram número; limite ausente continua `null`.
- `145 vagas` vira `145`; cadastro reserva isolado continua desconhecido.
- Datas ISO e `dd/mm/aaaa` viram `yyyy-mm-dd` após validação.
- URLs aceitam somente HTTP(S).

## Registro operacional

Cada execução cria uma linha `coletas` com provider `pci_mcp`, horários, status e contadores. O resumo contém recebidos, normalizados, descartados, únicos, criados, atualizados e sem alteração. Erros são truncados antes de persistir e nenhum secret entra nos logs.

## Agendamento

`.github/workflows/collectors.yml` executa os scripts diretamente, sem endpoint administrativo público:

- PCI: `05:17`, `13:17` e `21:17` UTC todos os dias (`02:17`, `10:17` e `18:17` em Fortaleza);
- descoberta web: `09:37` UTC todos os dias (`06:37` em Fortaleza);
- documentos: domingo `11:47` UTC (`08:47` em Fortaleza), limitada a cinco concursos e cinco arquivos por concurso.

Os horários evitam o início da hora, quando schedulers compartilhados tendem a concentrar carga. GitHub Actions pode atrasar jobs agendados; o banco registra o horário efetivo. O workflow só passa a operar depois que o repositório for publicado e seus secrets/variables forem configurados.

## Execução de previstos

```bash
npm run test:exa
npm run collect:predicted -- --dry-run
npm run collect:predicted
```

O dry-run carrega o catálogo real para testar matching, mas termina antes de qualquer `insert`, `update` ou `upsert`. O resumo separa resultados, URLs únicas, relevantes, matches, candidatos novos, candidatos elegíveis, duplicados, rejeições e seus motivos.

As queries ficam centralizadas em `src/lib/discovery/config.ts`. `DISCOVERY_QUERY_LIMIT`, `DISCOVERY_RESULTS_PER_QUERY` e `DISCOVERY_QUERY_DELAY_MS` controlam volume e intervalo; o padrão continua pequeno. Erro de uma query não invalida resultados válidos das demais, mas a coleta persistida recebe status parcial.

Cada execução persistente usa provider `web_discovery_exa`. Eventos usam fingerprint único; fontes usam domínio e tipo; vínculos usam movimento e URL. Repetir a mesma coleta deve produzir zero concursos, movimentos, fontes e vínculos novos.

Sem `EXA_API_KEY`, o endpoint compartilhado pode atingir quota. Resultados válidos das queries concluídas ainda são persistidos e a execução fica `PARTIAL`; site, PCI e Storage continuam disponíveis. Não há avalanche de retry.

## Execução documental

```bash
npm run collect:documents -- --dry-run
npm run collect:documents
```

O `DocumentCollector` implementa `discover`, `download`, `deduplicate`, `persist` e `extract` como etapas separadas do PCI. O piloto aceita no máximo 10 concursos, 10 arquivos por concurso, concorrência máxima 4, PDF de até 15 MiB por padrão, timeout de 20 segundos, até duas novas tentativas e três redirects. Cada destino redirecionado passa novamente pela proteção SSRF.

O dry-run faz download, hash e extração, mas não cria `coletas`, objetos ou linhas. Na persistência, o SHA-256 identifica o blob; hash já conhecido reutiliza `arquivos` e não envia outra cópia. Mesma URL com conteúdo diferente cria versão nova e aponta `supersedes_id` para a versão anterior.

Cada execução persistente registra provider `document_collector`, contadores e erros por candidato em `coletas`. Uma falha não interrompe os documentos restantes. Editais e gabaritos geram movimentações com fingerprint documental quando ainda não existe movimento equivalente.

## Lock, heartbeat e recuperação

`begin_collector_run` adquire o lock por nome antes de acessar o provider. `heartbeat_collector_run` renova o TTL durante o trabalho e `finish_collector_run` grava duração, contadores, status e libera o lock. Processo morto não deixa lock eterno: uma nova execução pode assumir após `locked_until`. GitHub `concurrency` reduz duplicidade no scheduler, mas o lock do banco é a garantia entre executores diferentes.

## Retries, timeouts e limites

Retries ficam nos providers, têm quantidade finita e backoff. MCP, HTTP e PDF possuem timeout. O PCI rejeita uma resposta acima de `PCI_SANITY_MAX_ITEMS` (padrão 2500); documentos mantêm limites de quantidade, tamanho, redirects e concorrência. Nenhum worker remove catálogo existente quando a fonte falha.

## Kill switches

Defina `ENABLE_PCI_COLLECTOR=false`, `ENABLE_WEB_DISCOVERY=false` ou `ENABLE_DOCUMENT_COLLECTOR=false` para impedir uma nova execução sem deploy. O processo sai como `disabled` antes de consultar a fonte. Ingestão de questões permanece manual e controlada.

## Operação

`npm run ops:status` mostra a última execução, último sucesso, duração, contadores e saúde. Logs são JSON estruturado e removem chaves, tokens, cookies e cabeçalhos de autorização. Consulte `docs/runbook.md` para incidentes e execução manual.
