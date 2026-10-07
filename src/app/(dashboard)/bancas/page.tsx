import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { listBoards } from "@/features/bancas/data/repository";

export const metadata = { title: "Bancas" };
export default async function BancasPage() {
  const boards = await listBoards();
  return <><header className="page-header"><div><h1>Bancas</h1><p>Perfis documentais com concursos relacionados, provas armazenadas e anos disponíveis.</p></div></header>{boards.length ? <div className="board-list">{boards.map((board) => <article className="board-row" key={board.id}><div className="board-row__name"><span className="org-monogram">{board.acronym ?? board.name.slice(0, 3).toUpperCase()}</span><div><h2><Link href={`/bancas/${board.slug}`}>{board.name}</Link></h2><span>{board.acronym ?? "Sem sigla"}</span></div></div><dl><div><dt>Provas</dt><dd className="numeric">{board.proofCount}</dd></div><div><dt>Concursos</dt><dd className="numeric">{board.contestCount}</dd></div><div><dt>Anos</dt><dd>{board.years.join(", ") || "—"}</dd></div></dl><Link className="row-action" href={`/bancas/${board.slug}`} aria-label={`Abrir perfil da banca ${board.name}`}><ArrowUpRight size={18} /></Link></article>)}</div> : <div className="panel"><EmptyState title="Nenhuma banca cadastrada" description="As bancas aparecerão quando forem vinculadas a dados reais. Não criamos registros fictícios para preencher esta página." /></div>}<span className="sr-only"><Building2 /></span></>;
}
