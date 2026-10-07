# Relatório da Fase 4

Data da validação: 6 de outubro de 2026.

## Resultado

A camada documental foi aplicada no Supabase real `kxitnwsiwefcovxdoqqv` sem reset e sem remover dados das fases anteriores. O catálogo passou de 471 para 472 concursos porque o piloto incluiu o registro histórico oficial PC-MA 2012; os 471 registros existentes foram preservados.

## Estado anterior e migrations

Antes da alteração, `editais`, `provas`, `gabaritos`, `arquivos` e `resultados` existiam e estavam vazias; não havia bucket documental. A implementação foi aditiva:

- `20261006174108_phase4_document_ingestion.sql`: metadata, SHA-256, extração, versionamento, relações, índices, triggers e bucket.
- `20261006175552_phase4_document_catalog_views.sql`: views públicas com `security_invoker`, selects enxutos e grants de leitura.

O banco não foi recriado. Auth, profiles, PCI, previstos, fontes, aliases, movimentações e dados existentes permaneceram intactos.

## Storage e documentos reais

Bucket: `radar-documentos`, público para leitura, PDF apenas, limite de 20 MiB e escrita restrita ao backend.

| Tipo | Documento | Origem | Bytes | Páginas | SHA-256 | Extração |
|---|---|---|---:|---:|---|---|
| Edital | Prefeitura de Acari — Edital 005/2026 | Prefeitura de Acari | 497.780 | 27 | `14b18b471e6edd540c2d924fa6898a9f82b76de3646d2944b7fdbf4272c06afc` | TEXT |
| Edital | PC-MA — Edital 02/2012 | FGV Conhecimento | 301.152 | 33 | `e7d683ab644a335febb43f5642123c33be2b5f2176747f952cf2c1b490f9e1d8` | TEXT |
| Prova | Investigador de Polícia — Tipo 1 | FGV Conhecimento | 789.448 | 16 | `96406263cc562b2e76e5c0df16f1e46d3379d6b134c1aeeaede301f527a33a38` | TEXT |
| Gabarito | Investigador de Polícia — definitivo | FGV Conhecimento | 197.978 | 4 | `cdd9e723dd18f237b5cf7d7502789e66a4afbd8ef44c1c98a4795a7c783ffb2b` | TEXT |

O PDF público da prova retornou HTTP 200, `application/pdf`, 789.448 bytes e assinatura `%PDF-`. A prova possui 56.749 caracteres normalizados persistidos.

## Coletas e idempotência

Dry-run: 4 encontrados, 4 downloads, 4 hashes e 4 extrações `TEXT`, sem upload ou escrita.

Primeira execução, coleta `74d6029e-d809-4cf7-b225-ab11e5c12ceb`:

- encontrados: 4;
- baixados: 4;
- uploads: 4;
- editais criados: 2;
- provas criadas: 1;
- gabaritos criados: 1;
- extrações `TEXT`: 4;
- parciais, escaneados, falhas e erros: 0.

Segunda execução, coleta `21aeeaf6-6c92-44c4-a818-044a4e69ce8b`:

- encontrados e baixados: 4;
- arquivos reconhecidos por hash: 4;
- uploads: 0;
- editais, provas e gabaritos criados: 0;
- erros: 0.

Nenhum PDF real do piloto era escaneado. A fixture local sem camada textual retornou `SCANNED` e não quebrou o pipeline; OCR ficou deliberadamente fora do escopo.

## Banco, RLS e segurança

Contagens finais principais:

- `concursos`: 472;
- `editais`: 2;
- `provas`: 1;
- `gabaritos`: 1;
- `arquivos`: 4;
- `resultados`: 0;
- `auth.users`: 2 usuários, ambos confirmados e preservados.

O teste com a chave pública confirmou leitura de `prova_catalog` e do PDF, vínculo com gabarito e bloqueio de escrita anônima em `public.arquivos` (`42501`). Upload anônimo no bucket também foi bloqueado por RLS. As tabelas documentais continuam com RLS; views concedem apenas `SELECT` a `anon` e `authenticated`; o worker usa service role somente no servidor.

`supabase db lint --linked --level warning` terminou sem erros de schema. A inspeção de tabelas confirmou os volumes remotos e os índices documentais aplicados; `arquivos` ocupa 192 kB de tabela e 296 kB de índices no piloto.

## Interface

Rotas implementadas e validadas com HTTP 200 e conteúdo real renderizado pelo Next.js:

- `/provas`: busca, banca, ano, órgão, cargo, UF e paginação de 20 itens;
- `/provas/8d159a4e-c485-4cfb-8e4a-39ff79684150`: prova, contexto, arquivo e gabarito;
- `/concursos/policia-civil-do-maranhao-2012`: edital, prova e gabarito reais;
- `/concursos/prefeitura-de-acari-rn-295413`: Edital nº 005/2026;
- `/bancas/fgv`: 1 prova, 1 concurso relacionado e ano 2012.

As listas não selecionam `texto_extraido`, diferenciam “Abrir PDF” de “Ver fonte” e mantêm estados vazios honestos. A inspeção visual foi feita em desktop e em viewport de 390 px; filtros, documento e ações reorganizaram sem overflow (`scrollWidth` 381 para `innerWidth` 390) e o console permaneceu sem warnings ou erros.

## Testes e qualidade

- lint: aprovado, zero warnings;
- typecheck: aprovado;
- testes: 13 arquivos e 59 testes aprovados;
- build: aprovado com Webpack, opção oficial do Next.js 16;
- banco: lint remoto aprovado, zero erros.

`npm audit --omit=dev` encontrou zero vulnerabilidades de produção. A auditoria completa aponta cinco alertas altos na cadeia de desenvolvimento `eslint-config-next → fast-glob → micromatch → braces`. A correção automática exigiria `--force` e rebaixaria `eslint-config-next` para 14.2.35, incompatível com o Next 16; por isso não foi aplicada.

Os 19 testes documentais cobrem hash, deduplicação, paths, URL, SSRF, MIME, assinatura PDF, parser, texto vazio, PDF escaneado, versionamento e matching. Testes unitários não acessam a internet.

## Observações

A primeira tentativa de aplicar a migration encontrou um índice legado já existente e foi revertida atomicamente; os `CREATE INDEX` foram tornados idempotentes e a aplicação seguinte concluiu. A primeira execução do script de coleta revelou um `await` no entrypoint CommonJS antes de qualquer rede ou escrita; ele foi corrigido. A primeira suíte completa dentro do sandbox do Windows perdeu arquivos temporários de transformação; a repetição fora desse isolamento aprovou todos os 59 testes. O build padrão do Turbopack sofreu um crash interno ao criar o processo do PostCSS no Windows; o script foi fixado em `next build --webpack`, opção documentada do Next.js 16, e o build completo passou.

Não foram implementados OCR, análise de questões, embeddings, pgvector, RAG, chat, ranking de assuntos ou pagamentos.
