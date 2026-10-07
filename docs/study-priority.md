# Prioridade de estudo

## Objetivo

Prioridade responde “o que estudar agora?” sem confundir incidência histórica com fraqueza pessoal. O cálculo é determinístico, reproduzível e não usa LLM.

## Evidências

Para cada disciplina elegível:

- incidência no recorte histórico;
- domínio atual do usuário;
- quantidade de questões únicas respondidas;
- atividade mais recente;
- relação do recorte com concurso, banca ou base global.

O concurso-alvo é usado primeiro. Sem questões específicas, o motor tenta a banca; sem amostra da banca, declara uso da base global. Nunca finge que dados globais pertencem ao concurso.

## Confiança da amostra

Os limites ficam centralizados em `SAMPLE_CONFIDENCE_THRESHOLDS`:

- 1–4 respostas: `LOW_SAMPLE`;
- 5–14: `MEDIUM_SAMPLE`;
- 15 ou mais: `HIGH_SAMPLE`.

Com menos de cinco respostas, o resultado é `NOT_ENOUGH_DATA`: “Responda mais questões para calcular sua prioridade”. Confiança média aplica peso 0,78; confiança alta aplica peso 1.

## Fórmula

Os componentes são normalizados para 0–1:

`score = sample_weight × 100 × (0,42 × frequency + 0,40 × weakness + 0,10 × target_relevance + 0,08 × recency)`

- `frequency`: percentual histórico limitado ao patamar de 25%;
- `weakness`: `1 - accuracy` do domínio atual;
- `target_relevance`: 1 para concurso, 0,75 para banca e 0,5 para base global;
- `recency`: 1 até 30 dias, 0,7 até 90 dias e 0,4 depois disso.

Rótulos: alta a partir de 60, média a partir de 35 e baixa abaixo de 35. O número interno não precisa aparecer; a UI mostra incidência, respostas, domínio, confiança e origem do recorte. A tentativa válida mais recente já representa a decisão simples de recência, sem decay complexo.

## Garantias

- alta incidência e baixo domínio elevam a prioridade;
- baixa incidência e alto domínio reduzem a prioridade;
- pouca amostra nunca vira recomendação forte;
- assunto sem classificação não recebe prioridade por assunto;
- a fórmula não altera estatísticas históricas nem persiste agregados derivados.
