# Runbook operacional

Todos os horários e evidências devem ser anotados em UTC e no fuso de Brasília/Fortaleza (UTC−3). Nunca cole secrets em tickets ou logs.

## Triagem inicial

1. Consulte `GET /api/health` e o status do deployment Vercel.
2. Execute `npm run ops:status` em ambiente seguro com service role.
3. Identifique o componente isolado: web, banco, Auth, Storage, PCI, Exa ou documentos.
4. Ative o kill switch do worker afetado antes de reexecutar repetidamente.
5. Preserve IDs de execução, timestamps e mensagens sanitizadas.

## Site fora do ar

- Se `/api/health` não responder, veja build/runtime da Vercel e variáveis públicas.
- Se responder `503` com database `unreachable`, confira status Supabase e URL/publishable key.
- Não rode collectors como tentativa de restaurar o site: os dados persistidos devem continuar legíveis.
- Para regressão de release, promova o deployment anterior e mantenha o banco no schema mais novo.

## Banco indisponível ou migration falhou

- Verifique `supabase migration list --linked` e `supabase db lint --linked`.
- Antes de aplicar, use `supabase db push --linked --dry-run`.
- Não use `db reset` em produção e não edite uma migration já aplicada; crie uma migration corretiva.
- Se a aplicação antiga ainda funciona, interrompa o rollout e faça forward-fix compatível.
- Drift profundo requer Docker para construir o shadow database; ausência dessa ferramenta deve ser registrada, não interpretada como “sem drift”.

## PCI falhando

1. Execute `npm run check:pci` (somente fonte, sem banco).
2. Confira a última linha de `pci_collector` em `npm run ops:status`.
3. Valide `PCI_MCP_URL` e o limite `PCI_SANITY_MAX_ITEMS` sem imprimir valores sensíveis.
4. Se a fonte estiver inconsistente, use `ENABLE_PCI_COLLECTOR=false`. Não apague concursos existentes.
5. Quando recuperar, rode uma coleta manual; a repetição deve resultar em itens inalterados.

## Exa sem quota

- `npm run test:exa` confirma conectividade sem persistência.
- Uma coleta parcial é aceitável; resultados confirmados permanecem e o site não depende do Exa.
- Configure `EXA_API_KEY` no executor, aguarde a janela de quota e reexecute uma vez.
- Não aumente retries; use `ENABLE_WEB_DISCOVERY=false` se houver falha contínua.

## Documentos ou Storage falhando

- Execute um piloto: `npm run collect:documents -- --max-concursos=1 --max-files-per-contest=2 --concurrency=1`.
- Confirme bucket `radar-documentos`, MIME PDF, hash e política de escrita bloqueada para anon.
- Falha em um arquivo não autoriza remover o anterior; a versão persistida é preservada.
- Interrompa com `ENABLE_DOCUMENT_COLLECTOR=false` em caso de fonte malformada ou volume inesperado.

## Worker travado

- Compare `heartbeat_at`/`locked_until` e a execução `RUNNING`.
- Não remova o lock ativo manualmente. O TTL permite recuperação do órfão.
- Após expirar, reexecute uma vez e confirme novo `runId`.
- Se houver processo real ainda executando, encerre-o no executor antes de recomeçar.

## Auth falhando

- Confirme Site URL, Redirect URLs, `NEXT_PUBLIC_SITE_URL`, HTTPS e cookies.
- Teste login/logout e uma rota protegida; recuperação deve usar uma única conta controlada para evitar spam.
- Não altere senhas/confirmação das duas contas reais durante diagnóstico.

## RLS ou escrita indevida

- Desative o fluxo afetado e rode `npm run validate:auth` e `npm run validate:phase7`.
- Verifique anon, usuário A, usuário B e service role separadamente.
- Não conceda acesso amplo como correção emergencial. Faça policy/migration específica.

## Falha de notificação

- Confirme acompanhamento/alerta do usuário e movimentação persistida.
- Verifique `deduplication_key`; reprocessar a mesma movimentação não deve criar outra linha.
- Não insira notificação sem vínculo e fonte apenas para preencher UI.

## Backup e restore

- Confirme primeiro o backup gerenciado no Dashboard Supabase.
- Faça dumps lógicos somente em estação segura e armazene fora do repositório.
- Restaure em projeto isolado, aplique validações e compare contagens.
- Nunca restaure sobre produção durante um teste.

## Encerramento do incidente

Registre causa, intervalo, componentes, `runId`/deployment, impacto, ação, validação e prevenção. Reative kill switches um por vez e confirme health, idempotência e ausência de erro recorrente.
