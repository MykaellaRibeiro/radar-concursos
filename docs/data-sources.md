# Fontes de dados

## Estratégia

Nenhuma fonte é autoridade única. Cada registro conserva URL, título, timestamps, hash e confiança. Fontes oficiais confirmam fatos; fontes especializadas ajudam a descobrir eventos antecipados.

## Providers

- `ConcursosProvider`: lista concursos abertos, busca por texto, cargo e cidade, e verifica saúde.
- `SearchProvider`: pesquisa geral, recente e restrita a domínio.
- `ContentExtractorProvider`: extrai conteúdo e hash de uma URL.

## PCI Concursos

O adapter PCI está isolado em `src/lib/providers/concursos` e usa `https://mcp.pciconcursos.com.br/mcp` com transporte MCP Streamable HTTP. A descoberta real de `tools/list` em 5 de outubro de 2026 encontrou:

- `listar_concursos`
- `pesquisar_concursos`
- `buscar_por_cargo`
- `buscar_por_cidade`
- `buscar_apostilas`

O Radar utiliza as quatro primeiras ferramentas; apostilas não entram nesta fase. `listar_concursos` sem filtros retornou todos os 470 itens em uma resposta e não publicou argumentos de paginação. O collector usa essa chamada ampla e deduplica localmente.

A fonte é gravada como `PCI Concursos`, tipo `SPECIALIZED`, `official=false`. O payload bruto fica em `raw_metadata` apenas para auditoria. A UI consome campos normalizados e mostra a fonte humana, nunca nomes de ferramentas MCP.

Campos ausentes permanecem `null`. Em especial, a listagem ampla não fornece cidade separada. UF e região são normalizadas; região é inferida da UF quando possível. `datas.aberto=true` é a única evidência usada para mapear `INSCRICOES_ABERTAS`.

## Exa e descoberta web

O Exa MCP é o mecanismo inicial de descoberta. Ele não é a base oficial do produto e nunca é chamado durante o carregamento de uma página. O formato normalizado conserva título, URL, domínio, data publicada, trecho, provider, instante de recuperação e metadados.

O ranking configurável distingue `OFFICIAL`, `EXAM_BOARD`, `SPECIALIZED_HIGH`, `SPECIALIZED`, `NEWS` e `OTHER`. Portais governamentais e oficiais promovem a confiança a `OFFICIAL`; duas fontes fortes independentes podem promover a `HIGH`; uma fonte especializada concreta resulta em `MEDIUM`. Rumor ou fonte sem sustentação permanece `LOW`.

Brave, Serper e Tavily podem implementar o mesmo `SearchProvider` no futuro. Firecrawl fica reservado como fallback de conteúdo, não como dependência obrigatória.

Artigos não são copiados integralmente. O sistema registra fatos extraídos e atribuição.

## Fontes documentais validadas

O piloto da Fase 4 usa somente origens primárias revisadas:

- Prefeitura Municipal de Acari: página oficial e Edital nº 005/2026.
- FGV Conhecimento: página do concurso PC-MA 2012, edital, prova objetiva de Investigador de Polícia e gabarito definitivo.

Cada arquivo conserva `source_url`, domínio, fonte, instante do download, SHA-256 e metadata HTTP disponível. O Storage é uma cópia operacional; a URL original continua sendo exibida na interface. Nenhum PDF foi inferido por nome ou aceito apenas pela extensão.

O `DocumentSearchProvider` reutiliza o contrato `SearchProvider` para descoberta de candidatos ausentes. Busca não equivale a aprovação: o collector persistente consome apenas candidatos confirmados no piloto.
