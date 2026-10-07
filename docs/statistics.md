# Estatísticas de questões

## Elegibilidade

Uma questão entra na distribuição por disciplina quando o nível está `CONFIRMED` ou `AUTO_CLASSIFIED` com confiança `HIGH`/`OFFICIAL`. Assuntos e subassuntos aplicam a mesma regra ao próprio nível e nunca herdam elegibilidade apenas da disciplina.

As views usam somente fatos persistidos no Supabase. Nenhum percentual é calculado sobre dados demonstrativos.

## Amostra

Toda distribuição expõe `sample_size`. O limiar central fica em `estatisticas_config`: amostras abaixo de 20 questões recebem `is_small_sample=true`. O piloto tem `n=70` por disciplina e `n=69` por assunto, portanto não é marcado como amostra pequena.

Percentual é `question_count / sample_size`, arredondado a duas casas. Filtros por prova, banca, concurso, ano, cargo e disciplina preservam a amostra do recorte exibido.

## Views

- `questao_estatisticas_base`: questões elegíveis e dimensões de filtro;
- `estatisticas_prova_disciplinas`: distribuição por disciplina;
- `estatisticas_prova_assuntos`: distribuição por assunto;
- `estatisticas_prova_subassuntos`: distribuição por subassunto.

Todas usam `security_invoker=true`, com `SELECT` para `anon` e `authenticated` e sem permissão de escrita.

## Estatística pessoal

Estatística global e desempenho pessoal não compartilham tabelas nem alteram uma à outra. O histórico considera todas as tentativas não anuladas; o domínio atual considera a tentativa não anulada mais recente de cada questão. Uma repetição errada seguida de acerto permanece 50% no histórico e correta no domínio atual.

Taxa de acerto é `corretas / tentativas válidas`. Anuladas ficam registradas e contam para cobertura, mas são excluídas do numerador e do denominador. Cobertura é `questões únicas vistas / questões disponíveis` no recorte. As mesmas regras são aplicadas a disciplina, assunto, subassunto, banca, concurso e períodos de 7/30 dias.

As views pessoais usam `security_invoker=true` e só concedem leitura a `authenticated`; a RLS restringe cada linha a `(select auth.uid()) = user_id`. A comparação em `/estatisticas` rotula explicitamente o lado histórico e o lado privado.
