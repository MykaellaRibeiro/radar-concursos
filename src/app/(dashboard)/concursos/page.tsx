import { ConcursoList } from "@/components/concursos/concurso-list";
import { Filters } from "@/components/concursos/filters";
import { MockNotice } from "@/components/ui/mock-notice";
import { listConcursos } from "@/features/concursos/data/repository";
import { concursoStatuses, type ConcursoStatus } from "@/types/domain";

export const metadata = { title: "Concursos" };

export default async function ConcursosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const values = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const status = concursoStatuses.includes(values.status as ConcursoStatus) ? values.status as ConcursoStatus : undefined;
  const salary = Number(values.salario_min);
  const items = await listConcursos(undefined, { query: values.q, status, region: values.regiao, state: values.uf, city: values.cidade, education: values.escolaridade, minimumSalary: Number.isFinite(salary) && salary > 0 ? salary : undefined, area: values.area, board: values.banca });
  return <><header className="page-header"><div><h1>Concursos</h1><p>Encontre oportunidades e compare o que já foi confirmado em cada fonte.</p></div></header>{items.some((item) => item.isMock) && <MockNotice />}<Filters values={values} /><ConcursoList items={items} /></>;
}
