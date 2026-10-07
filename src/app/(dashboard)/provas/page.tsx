import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { DocumentActions } from "@/components/documents/document-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { listProofFilterOptions, listProofs } from "@/features/provas/data/repository";
export const metadata = { title: "Provas" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const values = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const year = Number(values.ano);
  const page = Math.max(Number(values.pagina) || 1, 1);
  const filters = { query: values.q, board: values.banca, year: Number.isInteger(year) && year > 1900 ? year : undefined, organization: values.orgao, role: values.cargo, state: values.uf, page };
  const [catalog, options] = await Promise.all([listProofs(filters), listProofFilterOptions()]);
  const pageUrl = (target: number) => { const params = new URLSearchParams(Object.entries(values).flatMap(([key, value]) => value && key !== "pagina" ? [[key, value]] : [])); params.set("pagina", String(target)); return `/provas?${params}`; };
  return <>
    <header className="page-header"><div><h1>Provas</h1><p>Acervo validado de cadernos e gabaritos, com origem preservada e arquivos verificados.</p></div><span className="catalog-count numeric">{catalog.total} {catalog.total === 1 ? "prova" : "provas"}</span></header>
    <form className="proof-filters" action="/provas">
      <div className="filter-search"><Search size={17} /><label className="sr-only" htmlFor="proof-q">Buscar provas</label><input id="proof-q" name="q" defaultValue={values.q} placeholder="Concurso, órgão, cargo ou banca" /></div>
      <label><span>Banca</span><select name="banca" defaultValue={values.banca ?? ""}><option value="">Todas</option>{options.boards.map((board) => <option key={board.slug} value={board.slug}>{board.name}</option>)}</select></label>
      <label><span>Ano</span><select name="ano" defaultValue={values.ano ?? ""}><option value="">Todos</option>{options.years.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Órgão</span><select name="orgao" defaultValue={values.orgao ?? ""}><option value="">Todos</option>{options.organizations.map((org) => <option key={org.slug} value={org.slug}>{org.name}</option>)}</select></label>
      <label><span>Cargo</span><select name="cargo" defaultValue={values.cargo ?? ""}><option value="">Todos</option>{options.roles.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label><span>UF</span><select name="uf" defaultValue={values.uf ?? ""}><option value="">Todas</option>{options.states.map((state) => <option key={state}>{state}</option>)}</select></label>
      <button className="button button--secondary" type="submit">Filtrar</button>
      {Object.values(values).some(Boolean) && <Link className="proof-filters__reset" href="/provas">Limpar</Link>}
    </form>
    {catalog.items.length ? <div className="proof-list">{catalog.items.map((proof) => <article className="proof-row" key={proof.id}><div className="proof-row__identity"><span className="proof-year numeric">{proof.year ?? "—"}</span><div><h2><Link href={`/provas/${proof.id}`}>{proof.title}</Link></h2><p>{proof.organization} · {proof.state ?? "Brasil"}</p></div></div><dl className="proof-row__facts"><div><dt>Cargo</dt><dd>{proof.role ?? "Não informado"}</dd></div><div><dt>Banca</dt><dd>{proof.board ?? "Não informada"}</dd></div><div><dt>Questões</dt><dd className="numeric">{proof.questionCount ?? "—"}</dd></div></dl><div className="proof-row__actions"><DocumentActions storageUrl={proof.storageUrl} sourceUrl={proof.sourceUrl} title={proof.title} />{proof.answerKeys[0]?.storageUrl && <Link className="document-source-link" href={proof.answerKeys[0].storageUrl} target="_blank" rel="noopener noreferrer">Ver gabarito</Link>}</div></article>)}</div> : <div className="panel"><EmptyState title="Nenhuma prova anterior encontrada." description="Tente remover filtros ou volte quando novos documentos tiverem sido validados." /></div>}
    {catalog.totalPages > 1 && <nav className="pagination" aria-label="Paginação de provas">{catalog.page > 1 ? <Link href={pageUrl(catalog.page - 1)}><ChevronLeft size={15} /> Anterior</Link> : <span /> }<span>Página {catalog.page} de {catalog.totalPages}</span>{catalog.page < catalog.totalPages ? <Link href={pageUrl(catalog.page + 1)}>Próxima <ChevronRight size={15} /></Link> : <span />}</nav>}
  </>;
}
