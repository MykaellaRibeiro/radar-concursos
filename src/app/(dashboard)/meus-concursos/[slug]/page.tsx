import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getConcurso } from "@/features/concursos/data/repository";
import { getContestPreparation } from "@/features/study/data/repository";
import { formatPercent } from "@/lib/utils/format";

export default async function ContestPreparationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [contest, preparation] = await Promise.all([getConcurso(slug), getContestPreparation(slug)]);
  if (!contest) notFound();
  return <>
    <Link className="back-link" href="/meus-concursos"><ArrowLeft size={15} /> Voltar para meus concursos</Link>
    <header className="preparation-hero"><div><span className="eyebrow"><Target size={14} /> Painel de preparação</span><h1>{contest.titulo}</h1><p>{contest.orgao.nome} · {[contest.uf, contest.banca].filter(Boolean).join(" · ") || "Escopo nacional"}</p></div><StatusBadge status={contest.status} /></header>
    {!preparation.authenticated ? <section className="panel"><EmptyState title="Entre para ver sua preparação" description="O catálogo é público; seu desempenho e suas prioridades são privados." /><div className="empty-state-action"><Link className="button button--primary" href={`/login?next=${encodeURIComponent(`/meus-concursos/${slug}`)}`}>Entrar</Link></div></section>
      : preparation.available === 0 ? <section className="panel"><EmptyState title="Ainda não há questões deste concurso" description="Não há questões suficientes para calcular uma preparação personalizada. O Radar não completa a amostra com dados fictícios." /><div className="empty-state-action"><Link className="button button--secondary" href={`/concursos/${slug}`}>Ver evidências do concurso</Link><Link className="button button--primary" href="/estudar">Estudar pela base disponível</Link></div></section>
        : <>
          <section className="preparation-ledger"><div><span>Questões disponíveis</span><strong className="numeric">{preparation.available}</strong></div><div><span>Cobertura</span><strong className="numeric">{formatPercent(preparation.coverage)}</strong></div><div><span>Domínio atual</span><strong className="numeric">{formatPercent(preparation.current.accuracy)}</strong></div><div><span>Erros atuais</span><strong className="numeric">{preparation.current.incorrect}</strong></div></section>
          <div className="preparation-grid"><section className="panel"><header className="panel__header"><div><h2>Progresso por disciplina</h2><p>Cobertura e acerto são métricas separadas.</p></div></header><div className="performance-list">{preparation.disciplines.map((item) => <article key={item.id}><div><strong>{item.label}</strong><span>{item.answered} de {item.available} respondidas</span></div><dl><div><dt>Cobertura</dt><dd>{formatPercent(item.coverage)}</dd></div><div><dt>Acerto atual</dt><dd>{formatPercent(item.accuracy)}</dd></div></dl></article>)}</div></section>
          <section className="panel"><header className="panel__header"><div><h2>Prioridade explicável</h2><p>Incidência do concurso + domínio atual + confiança da amostra.</p></div></header><div className="priority-list">{preparation.priorities.map((item) => <article key={item.id}><div><span className={`priority-label priority-label--${item.priority.toLowerCase()}`}>{item.priority === "NOT_ENOUGH_DATA" ? "Sem prioridade ainda" : item.priority === "HIGH" ? "Alta" : item.priority === "MEDIUM" ? "Média" : "Baixa"}</span><strong>{item.label}</strong></div><ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article>)}</div></section></div>
          <div className="preparation-cta"><BookOpenCheck size={20} /><div><strong>Continuar com questões reais</strong><span>O modo de estudo usa somente o acervo persistido.</span></div><Link className="button button--primary" href={`/estudar?concurso=${encodeURIComponent(slug)}`}>Montar estudo</Link></div>
        </>}
  </>;
}
