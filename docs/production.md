# Produção

## Estado

Em 7 de outubro de 2026, banco, Auth, Storage e workers foram validados no projeto Supabase `kxitnwsiwefcovxdoqqv`. A aplicação ainda não possui URL Vercel: este diretório não é um repositório Git, não está vinculado a um projeto Vercel e a CLI Vercel está sem sessão. Portanto, deploy, smoke HTTPS e Auth no domínio real permanecem bloqueados por ação humana.

## Topologia

- Web: Next.js 16 na Vercel, Node.js 22.
- Banco/Auth/Storage: Supabase existente.
- Workers: scripts em `workers/`, disparados por GitHub Actions.
- Scheduler: `.github/workflows/collectors.yml`.
- CI: `.github/workflows/ci.yml`.
- Observabilidade: logs JSON, `coletas`, `collector_health` e `/api/health`.

Collectors não são executados dentro de requests Next.js e nenhum endpoint administrativo de coleta é exposto.

## Variáveis de ambiente

| Variável | Escopo | Obrigatória | Uso |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web e workers | Sim | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web | Sim | Cliente público protegido por RLS |
| `NEXT_PUBLIC_SITE_URL` | Web | Produção | Origem canônica e redirects Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Workers/scripts | Sim para escrita operacional | Nunca expor ao browser ou Preview desnecessário |
| `DATABASE_URL` | Operação manual | Opcional | Ferramentas PostgreSQL; nunca pública |
| `PCI_MCP_URL` | Worker PCI | Opcional | Endpoint MCP; existe padrão seguro |
| `PCI_SANITY_MAX_ITEMS` | Worker PCI | Opcional | Limite de segurança, padrão 2500 |
| `EXA_MCP_URL` | Worker web | Opcional | Endpoint MCP do Exa |
| `EXA_API_KEY` | Worker web | Recomendável | Evita quota compartilhada; nunca pública |
| `ENABLE_PCI_COLLECTOR` | Worker PCI | Opcional | Kill switch; `false` desativa |
| `ENABLE_WEB_DISCOVERY` | Worker web | Opcional | Kill switch; `false` desativa |
| `ENABLE_DOCUMENT_COLLECTOR` | Worker documental | Opcional | Kill switch; `false` desativa |
| `ENABLE_DEVELOPMENT_MOCKS` | Development | Opcional | Deve ficar ausente/`false` em produção |
| `RADAR_HEALTH_URL` | Operação | Opcional | Alvo do check de health |
| `SMOKE_BASE_URL` | Operação | Opcional | Base do smoke test |

`.env.example` contém somente valores falsos. `.env`, `.env.local`, `.env.development`, `.env.preview`, `.env.production` e variantes locais estão ignorados.

## Ambientes Vercel

- Development: credenciais públicas do Supabase e localhost autorizado no Auth; service role só para scripts locais controlados.
- Preview: credenciais públicas; não fornecer service role nem Exa por padrão. Se Preview precisar testar escrita, usar um projeto isolado.
- Production: URL/publishable key públicas e `NEXT_PUBLIC_SITE_URL` real. Workers recebem secrets no GitHub, não na aplicação Vercel.

Configuração Vercel esperada: framework detectado como Next.js, instalação `npm install`/`npm ci`, build `npm run build`, output padrão e Node 22. Não há necessidade de `vercel.json`.

## Publicação

1. Inicializar Git neste diretório, revisar arquivos e criar um repositório GitHub.
2. Enviar a branch principal e confirmar a execução do workflow de qualidade.
3. Importar o repositório na Vercel e criar Preview.
4. Configurar somente as variáveis próprias de Preview; executar `SMOKE_BASE_URL=<preview> npm run smoke`.
5. Promover para Production e registrar a URL em `NEXT_PUBLIC_SITE_URL`.
6. No Supabase Auth, definir a Site URL de produção e allow-list explícita para `/auth/callback` e `/nova-senha`; manter localhost apenas para desenvolvimento.
7. Validar login, logout, sessão, recuperação e rotas protegidas em HTTPS.
8. Configurar secrets/variables do GitHub e executar cada collector manualmente com limites antes de deixar schedules ativos.

## Scheduler e secrets do GitHub

Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e, quando disponível, `EXA_API_KEY`.

Variables: `PCI_MCP_URL`, `EXA_MCP_URL`, `PCI_SANITY_MAX_ITEMS` e os três kill switches. Use `true` para habilitar. A frequência está centralizada no workflow: PCI três vezes ao dia, web diariamente e documentos semanalmente.

## Health e versão

`GET /api/health` responde sem cache com estado da aplicação, alcance do banco, versão e timestamp. Ele não chama providers. `npm run ops:health` testa esse endpoint; `npm run ops:status` consulta a visão privilegiada dos collectors.

`package.json` é a fonte da versão. Releases devem ser identificadas por commit Git e deployment Vercel; o relatório atual não inventa um commit porque ainda não existe repositório.

## Segurança

- Headers: `nosniff`, `DENY`, `strict-origin-when-cross-origin` e bloqueio de câmera/microfone/geolocalização.
- CSP foi adiada: deve ser criada com nonce e testada contra Next.js, Supabase e Vercel; uma política não testada poderia quebrar Auth e assets.
- Catálogo é leitura pública; operação é service-role; dados pessoais são isolados por usuário.
- Links externos aceitam apenas HTTP(S); HTML externo não é renderizado.
- Download documental mantém proteção SSRF, tamanho, MIME, assinatura, redirects e hash.
- Tentativas têm limite transacional leve de 500 ms por usuário.

## Cache e SEO

As páginas públicas leem dados persistidos e não iniciam coleta. Metadata de detalhe usa dados reais; 404 e páginas privadas usam `noindex`. `robots.txt` bloqueia rotas privadas/API e `sitemap.xml` inclui rotas públicas e slugs reais. Não foi adicionado cache global a dados pessoais.

## Backup e recuperação

Não há evidência via CLI do plano atual nem de backup gerenciado habilitado; isso deve ser confirmado em Supabase Dashboard > Database > Backups. Não declarar Point-in-Time Recovery ativo sem essa tela.

Export lógico manual, executado em estação segura e fora do repositório:

```bash
supabase db dump --linked --schema public,private -f radar-schema.sql
supabase db dump --linked --data-only --schema public,private -f radar-data.sql
```

Proteja os dumps como dados sensíveis. Para recuperar, crie um projeto isolado, aplique migrations na ordem, restaure dados, execute lint/contagens/validações e só então planeje troca de tráfego. Nunca teste restore no banco de produção. O teste automatizado de restore não foi realizado porque o ambiente não possui Docker/projeto de recuperação.

## Retenção

`movimentacoes`, fontes, hashes e execuções são trilha de auditoria e não são apagados automaticamente. `web_discoveries` e `coletas` podem receber política futura após medir volume; nesta fase não há deleção automática de dados reais. Logs do GitHub/Vercel seguem a retenção das respectivas plataformas.

## Rollback

Para regressão da web, promover o deployment Vercel anterior. Não reverter migrations destrutivamente: as migrations da Fase 7 são aditivas e permitem forward-fix. Se um worker causar problema, desligar seu kill switch, preservar a execução em `coletas`, corrigir e reexecutar de forma idempotente.

## Ações humanas necessárias

1. Criar/vincular repositório GitHub e decidir nome/visibilidade.
2. Autenticar a CLI ou conectar a conta Vercel e importar o repositório.
3. Configurar variáveis Vercel/GitHub sem compartilhar secrets de produção com Preview.
4. Fornecer uma `EXA_API_KEY` própria para eliminar a quota compartilhada.
5. Confirmar backup/plano e habilitar leaked-password protection no Supabase, se o plano permitir.
6. Após obter a URL, configurar callbacks Auth e executar os testes de produção do checklist.
