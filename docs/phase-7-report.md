# Relatório da Fase 7

Data: 7 de outubro de 2026  
Fuso operacional: America/Fortaleza (UTC−3)  
Status: **PARCIALMENTE CONCLUÍDO**

## Resumo executivo

O Radar foi operacionalizado no código e no Supabase real: collectors independentes, lock com TTL, heartbeat, visão de saúde, logs estruturados, kill switches, schedules, CI, health endpoint, hardening web, SEO, scripts operacionais e documentação de recuperação. As migrations foram aplicadas e os fluxos reais de banco, Auth, RLS, Storage, PCI, Exa, documentos, questões e estudo passaram.

A fase não pode ser declarada concluída porque não existe repositório Git neste diretório, os workflows ainda não estão ativos remotamente, não há vínculo Vercel, a CLI Vercel está deslogada e não existe URL de Production. Assim, Preview/Production, Auth HTTPS, smoke, mobile/desktop e console/network no ambiente real não foram simulados.

## Infraestrutura

| Componente | Decisão | Estado |
| --- | --- | --- |
| Web | Vercel / Next.js 16 / Node 22 | Preparado; não implantado |
| Banco | Supabase PostgreSQL `kxitnwsiwefcovxdoqqv` | Operacional e validado |
| Auth | Supabase Auth SSR | Validado local/remoto; domínio de produção pendente |
| Arquivos | Supabase Storage `radar-documentos` | Operacional e validado |
| Workers | Scripts Node independentes | Executados contra produção |
| Scheduler | GitHub Actions | Arquivo pronto; ainda não ativado |
| CI | GitHub Actions | Arquivo pronto; ainda não ativado |

URL de produção: **não disponível**. Commit/build remoto: **não disponível**, pois não existe repositório Git.

## Implementação operacional

As migrations `20261007220000_phase7_operations.sql` e `20261007221500_phase7_collector_role_claim.sql` estão aplicadas. Elas adicionam métricas de execução, `private.collector_locks`, RPCs restritas a `service_role`, `collector_health` e rate limit de tentativas. A segunda migration corrige a leitura atual de claims via `auth.jwt()` descoberta durante o teste remoto.

O lock foi comprovado: primeira execução `acquired`, concorrente `already_running`, heartbeat aceito, finalização liberou e uma nova execução readquiriu. Anon não executou as RPCs.

Frequências configuradas:

- PCI: 05:17, 13:17 e 21:17 UTC diariamente;
- web discovery: 09:37 UTC diariamente;
- documentos: domingo 11:47 UTC.

O estado final de `collector_health` mostrou PCI, web discovery e documentos como `HEALTHY`.

## Execuções reais

### PCI

A fonte respondeu com 486 itens. Primeira execução: 486 encontrados, 70 criados, 22 atualizados, 394 inalterados, zero erros. Segunda execução: 486 encontrados, zero criados, zero atualizados e 486 inalterados. A fonte atual tem mais itens que os 470 do relatório anterior; os dados não foram forçados para um número antigo.

### Descoberta web

A primeira execução ficou `PARTIAL`: 18 únicos, 2 aceitos, 16 rejeitados, uma movimentação e uma fonte criadas; três queries atingiram a quota gratuita do Exa. A segunda terminou `SUCCESS`: 22 únicos, 3 aceitos, 19 rejeitados e nenhuma nova criação. A aplicação e os demais providers permaneceram disponíveis. Uma chave Exa própria continua recomendada.

### Documentos

Duas execuções piloto limitadas localizaram e baixaram um PDF já conhecido. Em ambas: um duplicado por hash, zero uploads, zero registros novos, extração de texto bem-sucedida e zero erros.

## Contagens finais reais

Contadas no Supabase após as coletas e antes de qualquer relatório:

| Tabela/conjunto | Registros |
| --- | ---: |
| concursos | 542 |
| órgãos | 494 |
| cargos | 2.673 |
| provas | 1 |
| questões | 70 |
| fontes | 6 |
| movimentações | 549 |
| editais | 2 |
| gabaritos | 1 |
| arquivos | 4 |
| notificações permanentes | 0 |
| tentativas permanentes | 0 |
| coletas | 18 |
| usuários Auth | 2 |

As contas `mykaellan@gmail.com` e `mykaella@wolfgestao.com` permaneceram confirmadas e não foram alteradas. Usuários e linhas criados pelas validações foram removidos.

## Auth, RLS e dados pessoais

- criação, login, logout e trigger de profile: aprovados;
- catálogo anônimo: leitura aprovada e escrita bloqueada;
- profiles anônimos: bloqueados;
- usuário A leu/alterou apenas linhas próprias; usuário B não leu nem alterou linhas de A;
- service role executou apenas os testes operacionais esperados;
- tentativas são imutáveis, correção permanece no banco e tentativa concorrente é serializada;
- cenário de Fase 6: 7 tentativas, 6 questões únicas, 4 acertos históricos em 6 e domínio atual 4 em 5;
- questões 38/67 permanecem anuladas e questão 46 permanece sem assunto.

A notificação foi validada com usuário temporário, acompanhamento de concurso e movimentação real: primeira passagem criou uma linha, repetição criou zero e a chave manteve uma linha. O usuário temporário foi removido em seguida.

## Storage

O bucket `radar-documentos` está público para leitura, mas escrita anônima foi bloqueada. Um PDF real retornou HTTP 200, `application/pdf`, 789.448 bytes e assinatura `%PDF-`. A extração persistida possui 16 páginas, hash SHA-256 e 56.749 caracteres.

## Segurança

Corrigido/adicionado: sanitização de logs, URLs externas HTTP(S), redirects Auth sem confiar em `Origin`, rotas privadas no proxy, RPCs operacionais restritas, RLS forçada em `coletas`, rate limit de tentativa, headers anti-clickjacking/sniffing e ausência de secrets reais em `.env.example`.

A varredura da árvore atual não encontrou padrão de service role, Exa key, database URL com senha ou `sb_secret_` fora de arquivos de ambiente ignorados. Não foi possível auditar histórico Git porque não existe `.git`.

`npm audit --omit=dev` encontrou zero vulnerabilidades.

Advisor de segurança executado: dois avisos remanescentes, ambos documentados — `pg_net` no schema `public` (preexistente e não movido automaticamente) e leaked-password protection desativada. Advisor de performance: apenas índices ainda sem uso, esperado pelo baixo volume/recência; nenhum índice foi removido sem carga representativa.

CSP não foi adicionada sem teste em Production. Esse hardening fica para depois do deploy com nonce e validação completa.

## Banco e migrations

`supabase migration list --linked` mostrou as 20 versões locais e remotas alinhadas até `20261007221500`. `supabase db lint --linked` retornou “No schema errors found”. A comparação profunda por shadow database não rodou porque Docker Desktop não está disponível; isso é limitação explícita, não confirmação de drift zero.

## Qualidade

| Gate | Resultado |
| --- | --- |
| lint | aprovado |
| typecheck | aprovado |
| testes unitários | aprovado: 19 arquivos, 77 testes |
| build de produção | aprovado: 21 páginas estáticas geradas e rotas dinâmicas compiladas |
| database lint | aprovado, zero erros |
| audit de produção npm | aprovado, zero vulnerabilidades |
| workflows YAML | sintaxe aprovada |

## Web e observabilidade

Foram adicionados `/api/health`, `error.tsx`, `global-error.tsx`, 404 coerente, metadata, canonical por concurso, Open Graph, sitemap e robots. Páginas privadas usam `noindex`. O logger gera JSON com collector, provider, runId, status, contadores e erro sanitizado.

O smoke do build local de produção aprovou 17 rotas: raiz, login, rotas privadas com redirect, catálogos, concurso/prova/questão reais, estatísticas, robots, sitemap e health. Robots bloqueou dashboard/estudo/API, sitemap continha um concurso real e o detalhe serviu title, description, Open Graph e canonical. A URL pública continua pendente, portanto isso não substitui o smoke pós-deploy.

Não há Sentry: coletas, health, logs do executor e Vercel são suficientes para a escala atual; um serviço externo só deve ser adicionado após o primeiro histórico real de incidentes.

## Backup, recuperação e rollback

Procedimentos de dump lógico, restore isolado, forward-fix e rollback da web estão em `production.md` e `runbook.md`. O plano/backup gerenciado do projeto não foi comprovado pela CLI. Restore não foi testado por falta de Docker/projeto isolado; produção não foi usada como laboratório.

## Bloqueios e ações necessárias

1. Definir nome/visibilidade, inicializar Git e publicar no GitHub.
2. Conectar/importar o repositório na Vercel; a CLI atual informou `Logged out`.
3. Configurar envs Vercel e secrets/variables GitHub.
4. Criar Preview, executar smoke e só então Production.
5. Configurar Site URL/Redirect URLs no Supabase com a URL final.
6. Validar Auth, escrita pessoal, Storage, SEO, mobile 390×844, desktop 1440×900, teclado, console e network na URL real.
7. Confirmar backup/plano no Dashboard e leaked-password protection.
8. Fornecer uma chave própria do Exa para estabilidade de quota.

## Classificação honesta

- **Concluído:** código operacional, migrations, workers, locks, health, logging, CI/scheduler locais, segurança aditiva e documentação.
- **Validado:** Supabase, Auth/RLS, Storage, PCI, Exa com degradação, documentos, questões, estudo, notificação, advisors, lint/typecheck/database lint.
- **Não validado:** URL HTTPS real, callbacks no domínio, Preview/Production, smoke/browser real, mobile/desktop e restore isolado.
- **Bloqueado:** deploy e automação ativa por ausência de repositório/vínculo Vercel/secrets remotos.
- **Recomendação futura:** Exa key própria, leaked-password protection, confirmar backups e implementar CSP após teste.
