import Link from "next/link";
import { BellRing, CalendarClock, FileText, Star } from "lucide-react";
import { getDashboardStats, listFollowedConcursos, listRecentMovements, listRecentPredictedMovements } from "@/features/concursos/data/repository";
import { MockNotice } from "@/components/ui/mock-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const [movements, predictedMovements, followed, stats] = await Promise.all([listRecentMovements(), listRecentPredictedMovements(), listFollowedConcursos(), getDashboardStats()]);
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
    <section className="panel predicted-pulse"><header className="panel__header"><h2>Radar de previstos</h2><Link href="/concursos/previstos" className="text-link">Explorar previstos</Link></header><div className="predicted-pulse__body">{predictedMovements.length ? predictedMovements.map((item) => <Link href={`/concursos/${item.competitionSlug}`} className="predicted-pulse__item" key={item.id}><strong>{item.organization} · {item.title}</strong><span>{item.competitionTitle}</span><time dateTime={item.eventDate}>{formatDate(item.eventDate)}</time></Link>) : <p className="watch-empty">Nenhuma movimentação prevista foi verificada ainda.</p>}</div></section>
    <div className="dashboard-grid">
      <section className="panel"><header className="panel__header"><h2>Movimentações recentes</h2><Link href="/concursos" className="text-link">Ver todas</Link></header><div className="timeline">{movements.map((item) => <article className="timeline-item" key={item.id}><span className="timeline-dot" /><div><h3>{item.organization} — {item.statusNew ? <StatusBadge status={item.statusNew} /> : item.title}</h3><p><Link href={`/concursos/${item.competitionSlug}`}>{item.competitionTitle}</Link> · {item.title}</p></div><time dateTime={item.eventDate}>{formatDate(item.eventDate)}</time></article>)}</div></section>
      <section className="panel"><header className="panel__header"><h2>No seu radar</h2><Link href="/meus-concursos" className="text-link">Gerenciar</Link></header><div className="watchlist">{followed.length ? followed.map((item) => <Link href={`/concursos/${item.slug}`} className="watch-row" key={item.id}><span className="org-monogram">{item.orgao.sigla?.slice(0,3) ?? item.uf ?? "BR"}</span><span className="watch-row__copy"><strong>{item.orgao.sigla ?? item.titulo}</strong><span>{item.titulo}</span></span><StatusBadge status={item.status} /></Link>) : <p className="watch-empty">Você ainda não acompanha concursos.</p>}</div></section>
    </div>
  </>;
}
