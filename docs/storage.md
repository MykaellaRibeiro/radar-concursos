# Supabase Storage

## Bucket documental

A Fase 4 usa um único bucket, `radar-documentos`, para evitar fragmentação desnecessária.

- leitura: pública, por URL do próprio Storage;
- escrita, alteração e remoção: somente backend confiável com service role;
- MIME permitido: `application/pdf`;
- tamanho máximo: 20 MiB;
- cache de objetos imutáveis: um ano;
- nomes: paths derivados de SHA-256.

O bucket público não transforma o browser em escritor. Não existem policies de `INSERT`, `UPDATE` ou `DELETE` para `anon` ou `authenticated` em `storage.objects`. A validação real tentou um upload anônimo e recebeu bloqueio de RLS.

## Paths

```text
editais/{concurso_id}/{sha256}.pdf
provas/{concurso_id}/{ano}/{sha256}.pdf
gabaritos/{prova_id}/{sha256}.pdf
resultados/{concurso_id}/{sha256}.pdf
documentos/{concurso_id}/{sha256}.pdf
```

O nome remoto existe apenas em metadata. A UI prefere o arquivo preservado no Storage e também oferece a origem oficial.

## Banco e acesso

As tabelas públicas de catálogo têm RLS habilitada e policies de leitura. Escritas públicas são ausentes. `prova_catalog` e `banca_catalog` usam `security_invoker` e grants apenas de `SELECT` para `anon` e `authenticated`.

`SUPABASE_SERVICE_ROLE_KEY` pertence ao ambiente do worker. Ela não deve existir em variáveis `NEXT_PUBLIC_*`, Client Components, logs ou metadata.
