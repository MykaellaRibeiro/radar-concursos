# Preparação pessoal

## Fronteira de dados

O catálogo de concursos, provas, questões, taxonomia e estatísticas históricas é público e somente leitura. Tentativas, bookmarks, alvos, desempenho e prioridades são privados. Operações de usuário usam a chave pública, sessão SSR e RLS; a service role não participa do browser nem das Server Actions pessoais.

## Estruturas

- `tentativas_questoes`: histórico imutável, com múltiplas tentativas por questão;
- `questoes_salvas`: bookmark idempotente por usuário e questão;
- `concursos_alvo`: alvo único por usuário/concurso e no máximo um principal;
- `concursos_seguidos`: estrutura anterior reutilizada pelo fluxo de alvo;
- `historico_desempenho_questoes`: todas as tentativas enriquecidas;
- `dominio_atual_questoes`: tentativa válida mais recente por questão;
- `cobertura_questoes_usuario`: questões únicas vistas, inclusive anuladas.

As três views pessoais são `security_invoker=true`. As tabelas têm RLS forçada. Tentativas concedem apenas `SELECT` e `INSERT`; políticas de `UPDATE` e `DELETE` negam explicitamente alterações para preservar a verdade histórica. Bookmarks e alvos têm políticas próprias para as quatro operações.

## Resposta e correção

O cliente envia somente questão, alternativa, contexto e duração opcional. O trigger do banco substitui `user_id`, consulta o gabarito oficial, deriva `correta`/`anulada`, numera a tentativa sob lock transacional e grava timestamps. O cliente nunca decide se acertou.

Anuladas são registradas normalmente. Elas contam como vistas na cobertura, não geram erro e não entram na taxa de acerto. A interface só revela resultado e gabarito depois de uma tentativa persistida; sem explicação validada, não inventa justificativa.

## Métricas

- histórico: todas as tentativas válidas;
- domínio atual: última tentativa válida de cada questão;
- cobertura: questões únicas vistas / questões disponíveis;
- acerto: corretas / válidas, sempre excluindo anuladas;
- tempo médio: duração das tentativas que informaram tempo;
- atividade: hoje, últimos 7 dias e timestamp mais recente.

As dimensões disponíveis são disciplina, assunto, subassunto, banca e concurso. “Revisar meus erros” usa o domínio atual; um acerto posterior remove a questão da fila, preservando o erro no histórico.

## Rotas

- `/questoes/[id]`: responder, repetir, salvar e navegar;
- `/estudar`: recorte real por concurso, taxonomia, banca, ano, prova e situação pessoal;
- `/questoes/salvas`: fila privada de bookmarks;
- `/meus-concursos`: concursos seguidos e alvos;
- `/meus-concursos/[slug]`: preparação contextual;
- `/dashboard`: atividade e continuidade;
- `/estatisticas`: incidência global comparada ao domínio pessoal.

Sessões persistidas não foram implementadas. O fluxo atual já oferece fila e sequência sem exigir contadores agregados ou estado redundante; uma sessão só deve ser adicionada quando houver requisito de retomada/resumo transacional.
