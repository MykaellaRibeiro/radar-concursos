-- Correct a discovery false positive: this file is a preliminary result,
-- not an exam booklet. Preserve the source blob and evidence as a result.

do $$
declare
  misclassified_proof public.provas%rowtype;
begin
  select * into misclassified_proof
  from public.provas
  where source_url = 'https://prefeitura.colombo.pr.gov.br/wp-content/uploads/2026/07/8.2.-Anexo-II-do-Edital-n.%C2%B0-08.001.2026-Resultado-preliminar-da-prova-objetiva.pdf'
  limit 1;

  if misclassified_proof.id is null then
    return;
  end if;

  insert into public.resultados (
    concurso_id,
    arquivo_id,
    tipo,
    titulo,
    url,
    storage_bucket,
    storage_path,
    sha256,
    published_at
  )
  select
    misclassified_proof.concurso_id,
    misclassified_proof.arquivo_id,
    'PRELIMINAR',
    misclassified_proof.titulo,
    misclassified_proof.source_url,
    misclassified_proof.storage_bucket,
    misclassified_proof.storage_path,
    misclassified_proof.sha256,
    misclassified_proof.published_at
  where not exists (
    select 1
    from public.resultados r
    where r.arquivo_id = misclassified_proof.arquivo_id
  );

  update public.arquivos
  set tipo = 'RESULTADO'
  where id = misclassified_proof.arquivo_id;

  delete from public.gabaritos where prova_id = misclassified_proof.id;
  delete from public.provas where id = misclassified_proof.id;
end $$;
