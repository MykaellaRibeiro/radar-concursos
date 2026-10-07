# Descoberta web

## Papel no Radar

A web é usada apenas para descobrir evidências. O Supabase continua sendo a base consultada pela aplicação. Nenhum componente React chama o Exa MCP.

`Exa MCP → SearchProvider → extração por regras → ranking da fonte → matching → deduplicação → Supabase`

## Queries e limites

As oito queries iniciais ficam em `src/lib/discovery/config.ts` e cobrem autorização, comissão, banca, previsão, edital e grupo de trabalho. Uma execução usa no máximo oito queries, cinco resultados por query e intervalo conservador entre chamadas. A janela normal é de sete dias.

## Extração e classificação

O extrator determinístico procura órgão, sigla, UF, cidade, vagas, banca, data e tipo de evento. Campos não demonstrados permanecem `null`. `eventToStatus()` só mapeia eventos que representam progressão; retificação, alteração de vagas e outros fatos podem criar uma movimentação sem mudar o status atual.

## Matching

1. Identificar o órgão por nome, alias ou sigla.
2. Exigir compatibilidade de UF quando ela estiver explícita.
3. Procurar concurso do órgão, favorecendo status pré-edital e similaridade textual.
4. Rejeitar empate ou contexto ambíguo.
5. Tratar como candidato novo apenas um rótulo de órgão identificável.

Siglas curtas sem UF não são suficientes para desambiguar órgãos homônimos. Um candidato novo só é elegível com fonte oficial ou duas fontes fortes de domínios independentes.

## Evidência e confiança

- `OFFICIAL`: confirmação direta oficial.
- `HIGH`: múltiplas fontes fortes independentes.
- `MEDIUM`: uma fonte especializada relevante e concreta.
- `LOW`: evidência fraca ou insuficiente.

Uma fonte oficial posterior usa o mesmo fingerprint, adiciona um vínculo e promove a confiança do movimento. A data de publicação é agrupada numa janela temporal para evitar duplicar a mesma notícia republicada em dias adjacentes.

## Persistência mínima

`web_discoveries` guarda URL, título, domínio, trecho curto, datas, hash, decisão e metadados técnicos. O texto integral do artigo não é persistido. `movimentacao_fontes` conserva cada evidência ligada ao evento e `concurso_fontes` conserva sua atribuição ao concurso.

## Rejeições

Os códigos possíveis são `irrelevant`, `missing_contest_context`, `old_content`, `duplicate`, `ambiguous`, `insufficient_evidence` e `unsupported_event`. O dry-run apresenta amostras e contagens para revisão humana.

## Operação segura

Execute primeiro `npm run test:exa`, depois o dry-run. Só persista quando os matches revisados estiverem corretos. `EXA_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis exclusivamente server-side.
