# Radar Concursos

SaaS full stack para descobrir, acompanhar e entender concursos públicos brasileiros. A fundação combina catálogo, histórico de movimentações, fontes e alertas; as próximas fases conectam coleta real e inteligência de provas.

## Stack

- Next.js 16 App Router, React 19 e TypeScript
- Tailwind CSS 4 e componentes próprios
- Supabase Auth, PostgreSQL e Storage
- Zod para validação e Vitest para regras de domínio
- Vercel para a aplicação; workers externos para coletas pesadas

## Instalação

Requer Node.js 22 ou mais recente.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Sem credenciais do Supabase, a aplicação mostra estados vazios reais. A prévia `MOCK` só é ativada quando `ENABLE_DEVELOPMENT_MOCKS=true` é definido explicitamente.

## Configuração do Supabase

O projeto existente usa o ref `kxitnwsiwefcovxdoqqv` e URL `https://kxitnwsiwefcovxdoqqv.supabase.co`. Não crie outro projeto.

1. Copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a publishable key do projeto.
3. Mantenha `SUPABASE_SERVICE_ROLE_KEY` e `DATABASE_URL` apenas no servidor.
4. Vincule a CLI: `supabase link --project-ref kxitnwsiwefcovxdoqqv`.
5. Compare o histórico com `supabase migration list --linked`, faça a prévia com `supabase db push --linked --dry-run` e só então aplique `supabase db push --linked`.
6. Em Authentication > URL Configuration, use `http://localhost:3000` como Site URL local e permita `http://localhost:3000/**`. Em produção, configure a URL real em `NEXT_PUBLIC_SITE_URL` e na allow-list; não antecipe um domínio.

O schema `public` remoto é dedicado ao Radar e seu histórico está representado nas migrations locais. Nunca execute `db reset --linked` em produção.

## Coleta PCI

O provider usa MCP Streamable HTTP diretamente no servidor, sem scraping e sem chamadas durante o carregamento das páginas.

```bash
npm run check:pci   # integração manual, somente leitura no PCI
npm run collect:pci # coleta e persistência; requer service role no servidor
```

`PCI_MCP_URL` é opcional e já aponta para `https://mcp.pciconcursos.com.br/mcp`. O serviço não exigiu autenticação durante a validação. `SUPABASE_SERVICE_ROLE_KEY` é usada somente pelo worker e nunca pode ser exposta ao browser.

As integrations de busca são opcionais. A aplicação não falha quando elas não estão configuradas.

## Descoberta web de concursos previstos

O `ExaSearchProvider` conecta o worker ao Exa MCP sem expor credenciais ao navegador. A busca apenas descobre páginas; classificação, matching, deduplicação, confiança e persistência acontecem no pipeline local, e a interface continua lendo somente o Supabase.

```bash
npm run test:exa                         # conexão e uma busca, sem escrita
npm run collect:predicted -- --dry-run  # revisão dos candidatos, sem escrita
npm run collect:predicted                # persistência server-side
```

`EXA_API_KEY` é opcional para o endpoint público, mas recomendada para evitar a cota compartilhada. Nunca use prefixo `NEXT_PUBLIC_` para ela. Consulte `docs/web-discovery.md` antes de persistir uma coleta.

## Documentos, provas e gabaritos

O `DocumentCollector` executa fora das requests do Next.js. Ele baixa somente candidatos revisados, valida URL, DNS, redirects, tamanho, MIME e assinatura PDF, calcula SHA-256 durante o streaming, envia uma única cópia ao Storage e extrai texto no worker.

```bash
npm run collect:documents -- --dry-run # download e extração, sem escrita
npm run collect:documents              # persistência server-side; requer service role
npm run validate:phase4                # integração manual com Supabase e Storage reais
```

O bucket público `radar-documentos` aceita apenas PDF de até 20 MiB. Público significa leitura; upload, alteração e remoção continuam restritos ao backend confiável. Consulte `docs/document-ingestion.md` e `docs/storage.md`.

## Questões e inteligência de prova

O piloto da Fase 5 processa exclusivamente a prova objetiva de Investigador de Polícia da PC-MA 2012, Tipo 1, e seu gabarito definitivo da FGV. O parser e o classificador são determinísticos, versionados e executados fora das requests do Next.js.

```bash
npm run parse:exam -- --dry-run                                  # extrai e classifica sem escrever
npm run parse:exam                                               # processa o piloto oficial
npm run parse:exam -- --proof 8d159a4e-c485-4cfb-8e4a-39ff79684150
npm run validate:phase5                                          # integração real com Supabase
```

Reprocessamento é idempotente por prova, número e hash do conteúdo. `--force` é reservado à mudança consciente de versão ou regras; `--all-unprocessed` existe para operação futura, mas não faz parte do piloto validado. Consulte `docs/question-ingestion.md`, `docs/taxonomy.md` e `docs/statistics.md`.

## Preparação pessoal

A Fase 6 mantém as estatísticas históricas públicas separadas de tentativas, questões salvas e concursos-alvo privados. Usuários autenticados podem responder questões reais, repetir tentativas sem perder o histórico, revisar erros atuais, acompanhar cobertura e receber prioridades determinísticas com motivos explícitos.

```bash
npm run validate:phase6 # cenário real temporário: persistência, matemática e RLS
```

Anuladas contam como questão vista, mas nunca entram no denominador da taxa de acerto. O domínio atual usa somente a tentativa válida mais recente de cada questão. Consulte `docs/personal-study.md` e `docs/study-priority.md`.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

As integrações reais ficam separadas do gate unitário: `npm run validate:auth`, `npm run validate:phase4`, `npm run validate:phase6` e `npm run validate:phase7`. Use `npm run ops:status` para consultar a saúde persistida dos workers e `npm run smoke` para verificar uma URL implantada.

## Deploy na Vercel

Importe o repositório, configure as variáveis por ambiente e use o preset Next.js com Node 22. Não execute collectors pesados em funções de request. Os jobs de `.github/workflows/collectors.yml` executam os scripts diretamente no GitHub Actions; consulte `docs/production.md` antes de ativá-los.

## Providers

Novas fontes implementam uma interface em `src/lib/providers`. O provider transforma dados externos para o modelo canônico; normalização, deduplicação e persistência permanecem fora do componente React. Consulte `docs/data-sources.md` e `docs/collectors.md`.

## Estado da entrega

A Fase 7 adiciona lock com TTL, health operacional, logs estruturados, kill switches, CI e agendamentos. O deploy público ainda depende de vincular este diretório a um repositório e autenticar a Vercel; o estado exato e as ações restantes estão em `docs/phase-7-report.md`.
