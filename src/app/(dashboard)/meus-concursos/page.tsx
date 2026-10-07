import Link from "next/link";
import { ArrowUpRight, Crosshair, Star, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { followCompetition, removeFollowedCompetition } from "@/features/concursos/actions";
import { listConcursos, listFollowedConcursos } from "@/features/concursos/data/repository";
import { removeContestTarget, setContestTarget } from "@/features/study/actions";
import { getPersonalStudyOverview } from "@/features/study/data/repository";

export const metadata = { title: "Meus concursos", robots: { index: false, follow: false } };

export default async function MyContestsPage() {
  const overview = await getPersonalStudyOverview();
  if (!overview.authenticated) return <>
    <header className="page-header"><div><h1>Meus concursos</h1><p>Seu centro de preparação combina concursos acompanhados, questões e prioridade de estudo.</p></div></header>
    <section className="panel"><EmptyState title="Entre para organizar sua preparação" description="Concursos-alvo, respostas e questões salvas ficam privados na sua conta." /><div className="empty-state-action"><Link className="button button--primary" href="/login?next=/meus-concursos">Entrar</Link></div></section>
  </>;
  const [followed, candidates] = await Promise.all([listFollowedConcursos(100), listConcursos()]);
  const followedIds = new Set(followed.map((item) => item.id));
  const suggestions = candidates.filter((item) => !followedIds.has(item.id)).slice(0, 5);
  return <>
    <header className="page-header"><div><span className="eyebrow">Preparação pessoal</span><h1>Meus concursos</h1><p>Defina o foco sem perder os demais concursos que você acompanha.</p></div><div className="page-actions"><Link className="button button--secondary" href="/questoes/salvas">Questões salvas</Link><Link className="button button--primary" href="/estudar">Estudar questões</Link></div></header>
    <section className="target-ledger" aria-label="Concursos-alvo">
      <header><div><Crosshair size={18} /><h2>Concursos-alvo</h2></div><span>{overview.targets.length} definidos</span></header>
      {overview.targets.length ? <div className="target-list">{overview.targets.map((target) => <article className={target.primary ? "target-row target-row--primary" : "target-row"} key={target.id}>
        <div><span>{target.primary ? "Alvo principal" : "Alvo secundário"}</span><h3>{target.title}</h3><p>{[target.state, target.boardName].filter(Boolean).join(" · ") || "Escopo nacional"}</p></div>
        <StatusBadge status={target.status as never} />
        <div className="target-row__actions"><Link className="button button--secondary" href={`/meus-concursos/${target.slug}`}>Abrir preparação <ArrowUpRight size={15} /></Link><form action={removeContestTarget}><input type="hidden" name="targetId" value={target.id} /><button className="icon-button" type="submit" aria-label={`Remover ${target.title} dos alvos`}><Trash2 size={16} /></button></form></div>
      </article>)}</div> : <EmptyState title="Escolha seu primeiro concurso-alvo" description="Um alvo organiza o recorte de incidência e deixa explícito o contexto das recomendações." />}
    </section>
    <section className="panel my-contests-panel"><header className="panel__header"><div><h2>Concursos acompanhados</h2><p>Definir um alvo também mantém o concurso no seu radar.</p></div><span className="numeric">{followed.length}</span></header>
      {followed.length ? <div className="my-contest-list">{followed.map((item) => {
        const target = overview.targets.find((entry) => entry.contestId === item.id);
        return <article className="my-contest-row" key={item.id}><span className="org-monogram">{item.orgao.sigla?.slice(0, 3) ?? item.uf ?? "BR"}</span><div><h3>{item.titulo}</h3><p>{item.orgao.nome} · {item.uf ?? "Brasil"}</p></div><StatusBadge status={item.status} /><div className="my-contest-row__actions">{!target && <form action={setContestTarget}><input type="hidden" name="concursoId" value={item.id} /><input type="hidden" name="slug" value={item.slug} /><input type="hidden" name="primary" value={overview.targets.length ? "false" : "true"} /><button className="text-link" type="submit"><Crosshair size={14} /> Definir alvo</button></form>}<Link className="text-link" href={`/concursos/${item.slug}`}>Ver concurso</Link><form action={removeFollowedCompetition}><input type="hidden" name="concursoId" value={item.id} /><button className="text-link text-link--danger" type="submit">Remover</button></form></div></article>;
      })}</div> : <EmptyState title="Você ainda não acompanha concursos" description="Acompanhe um concurso do catálogo ou defina um alvo abaixo para começar." />}
    </section>
    {suggestions.length > 0 && <section className="panel discovery-panel"><header className="panel__header"><div><h2>Adicionar ao radar</h2><p>Concursos reais do catálogo, sem recomendações inventadas.</p></div></header><div className="discovery-list">{suggestions.map((item) => <article key={item.id}><div><strong>{item.titulo}</strong><span>{item.orgao.nome} · {item.uf ?? "Brasil"}</span></div><form action={followCompetition}><input type="hidden" name="concursoId" value={item.id} /><input type="hidden" name="slug" value={item.slug} /><button className="button button--secondary" type="submit"><Star size={15} /> Acompanhar</button></form></article>)}</div></section>}
  </>;
}
