# Relatório da Fase 6

Data da validação: 7 de outubro de 2026.

## Entrega

Migration aplicada: `20261007193000_phase6_personal_study.sql`.

Objetos criados:

- tabelas `tentativas_questoes`, `questoes_salvas`, `concursos_alvo`;
- views `historico_desempenho_questoes`, `dominio_atual_questoes`, `cobertura_questoes_usuario`;
- trigger privado de correção/numeração;
- função transacional `definir_concurso_alvo`;
- índices por usuário/atividade, usuário/questão, FKs, unicidade e alvo principal.

Nenhuma tabela, questão, resposta oficial, classificação, flag, fonte ou movimentação anterior foi removida ou reescrita. `concursos_seguidos` foi reutilizada. Sessões persistidas não foram implementadas porque o fluxo não exigia estado agregado adicional.

## Segurança

RLS foi habilitada e forçada nas três tabelas. Todas usam `(select auth.uid()) = user_id`. Bookmarks e alvos têm políticas explícitas de leitura/criação/alteração/remoção. Tentativas permitem leitura/criação próprias e negam alteração/remoção para preservar o histórico. Views pessoais são `security_invoker=true` e não concedem acesso a `anon`.

O cenário com dois usuários temporários comprovou:

- usuário B não lê tentativas ou bookmarks de A;
- usuário B não remove bookmark de A;
- anônimo não grava tentativa;
- o próprio usuário não altera tentativa histórica;
- os dois usuários temporários e seus dados em cascata foram removidos ao final.

As contas `mykaellan@gmail.com` e `mykaella@wolfgestao.com` foram listadas e preservadas, sem alteração de senha, confirmação ou conteúdo.

## Cenário real e matemática

Foram usadas cinco questões normais reais, a anulada 38 e uma repetição, totalizando sete tentativas e seis questões únicas. Também foram persistidos um bookmark e um concurso-alvo.

- histórico válido: 4 corretas / 6 = 66,67%;
- anuladas: 1, excluída do denominador;
- domínio atual: 4 corretas / 5 = 80%;
- cobertura do cenário: 6 questões vistas;
- repetição: tentativa 1 errada e tentativa 2 correta, ambas preservadas;
- timestamps, alternativa marcada, correção, bookmark, alvo e follow confirmados por queries reais.

As questões 38 e 67 continuaram anuladas. A questão 46 continuou sem assunto. Os dados temporários foram removidos depois da validação; as tabelas pessoais encerraram sem registros de teste.

## Interface

Entregues `/estudar`, `/questoes/salvas`, resolução persistida em `/questoes/[id]`, hub em `/meus-concursos`, preparação em `/meus-concursos/[slug]`, pulso pessoal no dashboard e comparação global/pessoal em `/estatisticas`.

Capturas autenticadas foram verificadas em 1440×900 e 390×844 para dashboard, meus concursos, estatísticas, estudo, preparação, salvas e estados correta/incorreta/anulada. Não houve overflow estrutural; controles e alternativas permaneceram navegáveis em mobile. O navegador integrado não alcançou o localhost por isolamento de rede, então a captura foi feita com Chromium local contra o mesmo servidor Next.js. O detector Impeccable apontou somente o uso já estabelecido de Inter; a fonte foi preservada por ser parte do design system incumbente.

## Banco e performance

`supabase db lint --linked --level error`: nenhum erro de schema.

`supabase migration list --linked`: histórico local e remoto sincronizado até `20261007193000`.

`supabase inspect db index-usage --linked` comprovou uso de:

- `tentativas_questoes_user_question_latest_idx`;
- `tentativas_questoes_question_idx`;
- unicidades de bookmark e alvo;
- índice parcial de alvo principal.

O advisor de segurança/performance do painel não estava exposto pelas ferramentas atuais. Não foi declarado como aprovado. A inspeção CLI de índices e tabelas foi executada; não houve erro relacionado à Fase 6.

## Qualidade

- lint: aprovado;
- typecheck: aprovado;
- testes: 73/73 aprovados em 16 arquivos;
- build: aprovado, incluindo todas as rotas novas;
- validação Supabase: aprovada;
- database lint: aprovado.

Uma primeira execução do Vitest no sandbox falhou por remoção prematura de arquivos temporários do ambiente Windows; a mesma suíte executada fora desse isolamento passou integralmente. No fechamento, o servidor de desenvolvimento mantinha um log em `.next` aberto; ele foi encerrado de forma controlada e o build de produção passou integralmente.

## Decisões

Prioridade usa incidência, fraqueza, confiança, relevância do alvo e recência simples. Menos de cinco respostas retorna “sem prioridade ainda”. A UI sempre expõe os motivos e a origem do recorte. Nenhuma explicação acadêmica ou questão foi gerada.
