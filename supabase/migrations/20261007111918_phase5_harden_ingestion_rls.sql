create policy "No browser access to question ingestions"
on public.questao_ingestoes
for all
to anon, authenticated
using (false)
with check (false);

drop index if exists public.questoes_disciplina_classification_idx;
create index questoes_disciplina_classification_idx
  on public.questoes (disciplina_id, disciplina_status, disciplina_confidence);

create index if not exists questoes_assunto_classification_idx
  on public.questoes (assunto_id, assunto_status, assunto_confidence);

create index if not exists questoes_subassunto_classification_idx
  on public.questoes (subassunto_id, subassunto_status, subassunto_confidence);
