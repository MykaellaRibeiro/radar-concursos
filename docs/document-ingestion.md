# Ingestão documental

## Fluxo

`candidato revisado → URL segura → download em streaming → SHA-256 → extração → deduplicação → Storage → metadata semântica → UI`

O entrypoint é `npm run collect:documents`. O worker fica em `workers/collectors/documents.ts`; helpers reutilizáveis estão em `src/lib/documents`.

## Descoberta e revisão

O provider Exa localiza PDFs em domínios oficiais e de bancas. Seus resultados continuam sendo candidatos: somente PDF direto, fonte oficial/banca reconhecida e correspondência explícita com o órgão seguem para download, assinatura, extração e persistência. O manifesto piloto permanece disponível por `--pilot-only` como diagnóstico controlado.

Resultados e classificações também entram no acervo documental, sempre com a fonte original preservada.

## Download seguro

- somente HTTP(S), sem credenciais embutidas;
- resolução DNS e bloqueio de loopback, redes privadas, faixas reservadas e endpoints de metadata;
- nova validação a cada redirect, com limite de três;
- timeout de 20 segundos por tentativa e duas novas tentativas por padrão;
- limite padrão de 15 MiB e teto do bucket de 20 MiB;
- Content-Type restrito e assinatura `%PDF-` obrigatória;
- streaming para arquivo temporário com hash incremental;
- nenhum conteúdo baixado é executado.

## Persistência e versão

`arquivos` representa o blob validado. O índice único parcial em `sha256` impede cópias idênticas. O path é derivado de tipo, entidades relacionadas e hash, nunca do nome remoto. `editais`, `provas`, `gabaritos` e `resultados` representam o significado e apontam para `arquivo_id`.

Quando a mesma URL passa a entregar hash diferente, a versão aumenta e `supersedes_id` preserva a cadeia. O collector não sobrescreve silenciosamente o objeto anterior.

## Extração

`pdf-parse@2.4.5` extrai texto no worker. Quebras, espaços e controles são normalizados; binário e base64 nunca entram no PostgreSQL. Os estados são:

- `TEXT`: ao menos 200 caracteres úteis;
- `PARTIAL`: algum texto, abaixo do limiar;
- `SCANNED`: nenhuma camada textual útil;
- `FAILED`: erro do parser;
- `PENDING` e `NOT_APPLICABLE`: estados operacionais previstos pelo schema.

Não há OCR nesta fase. Um PDF escaneado continua armazenável e abrível; a fixture local `scanned.pdf` comprova que o pipeline marca `SCANNED` sem falhar.

## Encadeamento com questões

Uma prova só entra no parser de questões quando o arquivo armazenado tem hash, texto extraído e gabarito oficial relacionado. A ingestão documental continua responsável pelo binário e sua proveniência; a ingestão de questões consome esses registros sem refazer download nem upload. Consulte `question-ingestion.md`.

## Operação

Use dry-run antes de alterar o piloto. Confira título, origem, tipo, relações, tamanho, hash e estado de extração. Depois da coleta real, execute novamente: a segunda execução deve mostrar zero uploads e zero entidades semânticas novas.
