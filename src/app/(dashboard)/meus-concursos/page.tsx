import Link from "next/link";
import { Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { followCompetition, removeFollowedCompetition } from "@/features/concursos/actions";
import { listConcursos, listFollowedConcursos } from "@/features/concursos/data/repository";

export const metadata = { title: "Meus concursos", robots: { index: false, follow: false } };

export default async function MyContestsPage() {
  const [followed, candidates] = await Promise.all([listFollowedConcursos(100), listConcursos()]);
  const followedIds = new Set(followed.map((item) => item.id));
  const suggestions = candidates.filter((item) => !followedIds.has(item.id)).slice(0, 5);
  return <>
    <header className="page-header"><div><h1>Meus concursos</h1><p>Acompanhe oportunidades e volte rapidamente às informações verificadas.</p></div><div className="page-actions"><Link className="button button--secondary" href="/concursos/previstos">Ver previstos</Link><Link className="button button--primary" href="/concursos">Pesquisar concursos</Link></div></header>
    <section className="panel my-contests-panel"><header className="panel__header"><div><h2>Concursos acompanhados</h2><p>Sua seleção pessoal dentro do catálogo do Radar.</p></div><span className="numeric">{followed.length}</span></header>
      {followed.length ? <div className="my-contest-list">{followed.map((item) => <article className="my-contest-row" key={item.id}><span className="org-monogram">{item.orgao.sigla?.slice(0, 3) ?? item.uf ?? "BR"}</span><div><h3>{item.titulo}</h3><p>{item.orgao.nome} · {item.uf ?? "Brasil"}</p></div><StatusBadge status={item.status} /><div className="my-contest-row__actions"><Link className="text-link" href={`/concursos/${item.slug}`}>Ver concurso</Link><form action={removeFollowedCompetition}><input type="hidden" name="concursoId" value={item.id} /><button className="text-link text-link--danger" type="submit">Remover</button></form></div></article>)}</div> : <EmptyState title="Você ainda não acompanha concursos" description="Pesquise no catálogo e acompanhe as oportunidades que interessam a você." />}
    </section>
    {suggestions.length > 0 && <section className="panel discovery-panel"><header className="panel__header"><div><h2>Adicionar ao radar</h2><p>Concursos reais do catálogo, sem recomendações inventadas.</p></div></header><div className="discovery-list">{suggestions.map((item) => <article key={item.id}><div><strong>{item.titulo}</strong><span>{item.orgao.nome} · {item.uf ?? "Brasil"}</span></div><form action={followCompetition}><input type="hidden" name="concursoId" value={item.id} /><input type="hidden" name="slug" value={item.slug} /><button className="button button--secondary" type="submit"><Star size={15} /> Acompanhar</button></form></article>)}</div></section>}
  </>;
}
