import Link from "next/link";
import { BellRing, BookOpenCheck, CalendarClock, FileText, RotateCcw, Star, Target } from "lucide-react";
import { getDashboardStats, listFollowedConcursos, listRecentMovements, listRecentPredictedMovements } from "@/features/concursos/data/repository";
import { MockNotice } from "@/components/ui/mock-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getPersonalStudyOverview } from "@/features/study/data/repository";
import { formatPercent } from "@/lib/utils/format";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const [movements, predictedMovements, followed, stats, study] = await Promise.all([listRecentMovements(), listRecentPredictedMovements(), listFollowedConcursos(), getDashboardStats(), getPersonalStudyOverview()]);
  const mock = movements.some((item) => item.isMock);
  let userName = process.env.NODE_ENV === "development" ? "Marina" : "Visitante";
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userName = String(data.user?.user_metadata?.nome ?? data.user?.email?.split("@")[0] ?? userName);
  }
  return <>
    <header className="page-header"><div><h1>Olá, {userName}.</h1><p>Veja o que mudou nos concursos que você acompanha.</p></div><div className="page-actions"><Link href="/alertas" className="button button--secondary"><BellRing size={17} /> Criar alerta</Link><Link href="/concursos" className="button button--primary">Explorar concursos</Link></div></header>
    {mock && <MockNotice />}
    <section className="metrics-strip" aria-label="Resumo do radar">
      <article className="metric"><div className="metric__top"><span>Concursos acompanhados</span><Star size={18} /></div><strong>{stats.followed ?? "—"}</strong><small>{stats.followed === null ? "Dados indisponíveis" : "no seu radar"}</small></article>
      <article className="metric"><div className="metric__top"><span>Novos concursos</span><BellRing size={18} /></div><strong>{stats.newCompetitions ?? "—"}</strong><small>{stats.newCompetitions === null ? "Dados indisponíveis" : "nas últimas 24 horas"}</small></article>
      <article className="metric"><div className="metric__top"><span>Editais publicados</span><FileText size={18} /></div><strong>{stats.publishedNotices ?? "—"}</strong><small>{stats.publishedNotices === null ? "Dados indisponíveis" : "nas últimas 24 horas"}</small></article>
      <article className="metric"><div className="metric__top"><span>Prazos encerrando</span><CalendarClock size={18} /></div><strong>{stats.endingSoon ?? "—"}</strong><small>{stats.endingSoon === null ? "Dados indisponíveis" : "nos próximos 7 dias"}</small></article>
    </section>
    {study.authenticated && <section className="study-pulse" aria-label="Preparação pessoal">
      <header><div><span className="eyebrow">Preparação pessoal</span><h2>{study.history.attempts ? "Seu estudo, em evidências" : "Sua preparação começa com uma resposta"}</h2></div><Link href="/estatisticas#meu-desempenho" className="text-link">Ver desempenho</Link></header>
      {study.history.attempts ? <div className="study-pulse__grid">
        <div className="study-pulse__numbers"><article><span>Hoje</span><strong className="numeric">{study.today.attempts}</strong><small>{formatPercent(study.today.accuracy)} de acerto</small></article><article><span>Últimos 7 dias</span><strong className="numeric">{study.last7Days.attempts}</strong><small>{formatPercent(study.last7Days.accuracy)} de acerto</small></article><article><span>Cobertura da base</span><strong className="numeric">{formatPercent(study.coverage)}</strong><small>{study.history.answeredQuestions} de {study.availableQuestions} questões</small></article></div>
        <div className="study-pulse__focus"><Target size={18} /><div><span>Próximo foco explicado</span><strong>{study.priorities[0]?.label ?? "Amostra pessoal insuficiente"}</strong><p>{study.priorities[0]?.priority === "NOT_ENOUGH_DATA" ? "Responda mais questões para calcular sua prioridade." : study.priorities[0]?.reasons.slice(0, 2).join(" · ")}</p></div></div>
        <div className="study-pulse__actions"><Link className="button button--primary" href="/estudar"><BookOpenCheck size={16} /> Continuar estudando</Link><Link className="button button--secondary" href="/estudar?situacao=erros&ordem=erros"><RotateCcw size={16} /> Revisar {study.currentErrors} erros</Link></div>
      </div> : <div className="study-pulse__empty"><p>Responda questões reais para medir domínio atual, cobertura e prioridades. Nenhuma recomendação é criada sem amostra.</p><Link className="button button--primary" href="/estudar">Escolher questões</Link></div>}
    </section>}
    <section className="panel predicted-pulse"><header className="panel__header"><h2>Radar de previstos</h2><Link href="/concursos/previstos" className="text-link">Explorar previstos</Link></header><div className="predicted-pulse__body">{predictedMovements.length ? predictedMovements.map((item) => <Link href={`/concursos/${item.competitionSlug}`} className="predicted-pulse__item" key={item.id}><strong>{item.organization} · {item.title}</strong><span>{item.competitionTitle}</span><time dateTime={item.eventDate}>{formatDate(item.eventDate)}</time></Link>) : <p className="watch-empty">Nenhuma movimentação prevista foi verificada ainda.</p>}</div></section>
    <div className="dashboard-grid">
      <section className="panel"><header className="panel__header"><h2>Movimentações recentes</h2><Link href="/concursos" className="text-link">Ver todas</Link></header><div className="timeline">{movements.map((item) => <article className="timeline-item" key={item.id}><span className="timeline-dot" /><div><h3>{item.organization} — {item.statusNew ? <StatusBadge status={item.statusNew} /> : item.title}</h3><p><Link href={`/concursos/${item.competitionSlug}`}>{item.competitionTitle}</Link> · {item.title}</p></div><time dateTime={item.eventDate}>{formatDate(item.eventDate)}</time></article>)}</div></section>
      <section className="panel"><header className="panel__header"><h2>No seu radar</h2><Link href="/meus-concursos" className="text-link">Gerenciar</Link></header><div className="watchlist">{followed.length ? followed.map((item) => <Link href={`/concursos/${item.slug}`} className="watch-row" key={item.id}><span className="org-monogram">{item.orgao.sigla?.slice(0,3) ?? item.uf ?? "BR"}</span><span className="watch-row__copy"><strong>{item.orgao.sigla ?? item.titulo}</strong><span>{item.titulo}</span></span><StatusBadge status={item.status} /></Link>) : <p className="watch-empty">Você ainda não acompanha concursos.</p>}</div></section>
    </div>
  </>;
}
