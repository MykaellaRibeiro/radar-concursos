# Ingestão de questões

## Escopo validado

O piloto cobre somente a prova objetiva PC-MA 2012 — Investigador de Polícia — Tipo 1, da FGV, identificada por `8d159a4e-c485-4cfb-8e4a-39ff79684150`. O caderno e o gabarito definitivo já estavam persistidos e verificados na Fase 4.

## Pipeline

`prova persistida → parse do caderno → parse do gabarito → vínculo por número → classificação conservadora → upsert → auditoria`

- `fgv-objective-v1.0.0` extrai as 70 questões objetivas, enunciado, alternativas, página, texto bruto e indicadores de qualidade.
- `fgv-answer-key-v1.0.0` lê o gabarito Tipo 1, incluindo as anulações 38 e 67.
- `pcma-rules-v1.0.2` classifica primeiro as faixas oficiais de disciplina e, quando a evidência textual é suficiente, assunto e subassunto.
- `questao_ingestoes` registra hashes, versões, contagens, erros e horários de cada execução.

O parser preserva caracteres imperfeitos do PDF em `texto_bruto` e não inventa conteúdo visual ausente. Questões dependentes de imagem ou com extração incompleta recebem qualidade menor e revisão necessária.

## Operação

Sempre comece com dry-run:

```bash
npm run parse:exam -- --dry-run
npm run parse:exam -- --proof 8d159a4e-c485-4cfb-8e4a-39ff79684150 --dry-run
```

Na escrita, o processo usa apenas credencial server-side. A reexecução sem alteração resulta em zero inserts e zero updates. `--force` regrava intencionalmente a classificação e deve ser usado somente quando a versão ou regra mudou. `--all-unprocessed` está preparado para expansão futura e não deve ser executado como parte deste piloto.

## Critérios de aceite do piloto

- 70 números sequenciais, de 1 a 70;
- 70 resultados oficiais vinculados, sendo 68 letras e 2 anulações;
- página, proveniência, hash e versões presentes em todas as questões;
- nenhuma duplicata por prova e número;
- segunda execução idempotente;
- leitura anônima permitida pelas views e escrita anônima bloqueada.
