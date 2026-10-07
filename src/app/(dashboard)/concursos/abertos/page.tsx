import { ConcursoList } from "@/components/concursos/concurso-list";
import { MockNotice } from "@/components/ui/mock-notice";
import { listConcursos } from "@/features/concursos/data/repository";

export const metadata = { title: "Concursos abertos" };

export default async function AbertosPage() {
  const items = await listConcursos(["EDITAL_PUBLICADO", "INSCRICOES_ABERTAS"]);
  return <><header className="page-header"><div><h1>Concursos abertos</h1><p>Editais publicados e inscrições abertas, com prazos visíveis e fonte rastreável.</p></div></header>{items.some((item) => item.isMock) && <MockNotice />}<ConcursoList items={items} /></>;
}
