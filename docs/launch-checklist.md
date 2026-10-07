# Checklist de lançamento

Atualizado em 7 de outubro de 2026. `[x]` significa executado e comprovado; `[ ]` exige ação ou validação.

## Código e ambientes

- [x] Node.js 22 declarado; Next.js detectável sem configuração customizada.
- [x] `.env.example` usa valores falsos e arquivos de secrets estão ignorados.
- [x] Service role, database URL e Exa não são importados pelo browser.
- [x] Headers de segurança básicos configurados.
- [ ] Repositório Git criado e enviado ao GitHub.
- [ ] Projeto Vercel vinculado, Preview implantado e Production promovida.
- [ ] Variáveis separadas entre Development, Preview e Production.

## Auth

- [x] Auth/RLS real validado com usuários temporários A/B.
- [x] As duas contas reais foram preservadas sem alteração.
- [x] Rotas privadas incluem dashboard, meus concursos, estudar, salvas, alertas e configurações.
- [ ] Site URL e Redirect URLs configuradas para o domínio final.
- [ ] Login, logout, signup, recovery, sessão e return URL validados em HTTPS real.
- [ ] Leaked-password protection habilitada ou risco formalmente aceito.

## Banco e segurança

- [x] Migrations locais/remotas alinhadas até `20261007221500`.
- [x] Database lint sem erros.
- [x] Advisors de segurança e performance executados.
- [x] RLS testada para anon, usuário A, usuário B e service role.
- [x] Rate limit transacional de tentativas validado sem alterar a matemática.
- [x] Auditoria da árvore atual não encontrou padrão de secret real fora dos arquivos ignorados.
- [ ] Drift estrutural profundo repetido em máquina com Docker.
- [ ] Histórico Git auditado depois que o repositório existir.
- [ ] Confirmar backup gerenciado/plano no Dashboard Supabase.

## Storage

- [x] Bucket `radar-documentos` público para leitura.
- [x] PDF real retornou `200`, `application/pdf` e assinatura `%PDF-`.
- [x] Escrita anônima no banco e Storage foi bloqueada.
- [x] Collector reutilizou hash existente sem novo upload em duas execuções.

## Collectors e automação

- [x] PCI, web discovery e documentos usam lock, TTL, heartbeat, kill switch e logging estruturado.
- [x] Concorrência devolveu `already_running`; lock foi liberado e readquirido.
- [x] PCI executado duas vezes: segunda passagem sem criação/alteração.
- [x] Web discovery executado duas vezes; quota parcial reconhecida e execução seguinte saudável.
- [x] Documentos executado duas vezes; arquivo duplicado não foi reenviado.
- [x] `collector_health` mostra os três collectors como `HEALTHY` na última execução.
- [x] Workflows de CI e scheduler estão versionados localmente.
- [x] Sintaxe dos dois workflows validada.
- [ ] Workflows ativos em repositório GitHub com secrets/variables configurados.
- [ ] `EXA_API_KEY` própria configurada para evitar quota compartilhada.

## Dados e regressões

- [x] 70 questões e 70 respostas oficiais continuam vinculadas.
- [x] Questões 38 e 67 continuam anuladas.
- [x] Questão 46 continua sem assunto por falta de evidência.
- [x] Tentativas privadas, repetição, bookmark, alvo e prioridade validados.
- [x] Notificação temporária foi criada uma vez e deduplicada; dados temporários removidos.
- [x] Sem mocks automáticos em produção.

## Web, SEO e UX

- [x] Error boundaries, 404 e loading coerentes e sem stack trace para o usuário.
- [x] `/api/health`, metadata, robots e sitemap implementados.
- [x] Rotas privadas usam `noindex`.
- [x] Protocolos de links externos são validados.
- [x] Build local serviu title, description, Open Graph, canonical, robots privado e sitemap com slug real.
- [ ] Smoke test na URL de Production.
- [ ] Detalhe real, questão real e documento real abertos em Production.
- [ ] Desktop 1440×900, mobile 390×844, teclado, contraste, console e network validados em Production.
- [ ] Auth e escrita pessoal testados na URL real com limpeza posterior.

## Qualidade e recuperação

- [x] Lint.
- [x] Typecheck.
- [x] Testes finais: 19 arquivos e 77 testes aprovados.
- [x] Build final de produção aprovado.
- [x] `npm audit --omit=dev`: zero vulnerabilidades.
- [x] Runbook, backup/restore e rollback documentados.
- [ ] Restore testado em projeto separado.

## Liberação

A liberação só pode ser marcada como concluída depois de todos os itens de deploy e validação em Production. Até lá, o estado correto é **parcialmente concluído**.
