# Taxonomia de questões

## Hierarquia

`disciplina → assunto → subassunto`

A disciplina pode ser determinada pela faixa oficial do caderno. Assunto e subassunto exigem evidência explícita no enunciado; ausência de evidência deixa o nível sem classificação em vez de completar por suposição.

## Estados

- `UNCLASSIFIED`: sem evidência suficiente;
- `AUTO_CLASSIFIED`: regra determinística produziu classificação;
- `REVIEW_REQUIRED`: extração ou evidência exige revisão humana;
- `REVIEWED`: revisão humana feita, ainda não confirmada;
- `CONFIRMED`: classificação confirmada.

Cada nível tem estado e confiança próprios. As confianças são `LOW`, `MEDIUM`, `HIGH` e `OFFICIAL`. `OFFICIAL` é reservado à informação explicitamente definida pela fonte oficial, não à inferência do classificador.

## Piloto PC-MA 2012

As faixas oficiais do gabarito definem sete disciplinas: Língua Portuguesa (1–15), Legislação Específica (16–20), Raciocínio Lógico-quantitativo (21–30), Noções de Informática (31–40), Noções de Direito Constitucional (41–47), Noções de Direito Administrativo (48–55) e Noções de Direito Penal e Processual Penal (56–70).

O seed contém 47 assuntos e 5 subassuntos possíveis. Na prova, 69 questões receberam assunto elegível e 7 receberam subassunto. A questão 46 permanece sem assunto por ter enunciado genérico; isso é comportamento intencional e conservador.

## Evolução

Novas regras entram com nova versão de classificador e testes de fronteira. Não altere silenciosamente classificações confirmadas. Revisões humanas futuras devem registrar autor e data antes de promover o estado.

## Uso na preparação

O motor pessoal consome a taxonomia elegível existente; ele não promove nem completa classificações. A questão 46 permanece sem assunto e pode participar de métricas por disciplina, mas não de recomendações por assunto. Questões marcadas para revisão conservadora continuam persistidas e não ganham granularidade fina apenas para preencher uma prioridade.
