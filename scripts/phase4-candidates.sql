select
  c.id,
  c.slug,
  c.titulo,
  c.status,
  c.uf,
  c.cidade,
  c.provider,
  c.external_id,
  c.raw_metadata -> 'noticia' ->> 'link' as pci_url,
  o.nome as orgao
from public.concursos c
join public.orgaos o on o.id = c.orgao_id
where c.titulo ilike '%Acari%'
   or o.nome ilike '%Acari%'
order by c.updated_at desc;
