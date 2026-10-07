import Link from "next/link";
import { BarChart3, FileCheck2, SearchCheck } from "lucide-react";
import { RankedBars } from "@/components/questions/ranked-bars";
import { EmptyState } from "@/components/ui/empty-state";
import { getGlobalQuestionInsights, listStatisticsFilterOptions } from "@/features/questions/data/repository";
import { getPersonalStudyOverview } from "@/features/study/data/repository";
import { formatPercent } from "@/lib/utils/format";

export const metadata = { title: "Estatísticas" };
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : undefined;

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const year = Number(value(values.ano));
  const filters = {
    board: value(values.banca),
    year: Number.isInteger(year) && year > 1900 ? year : undefined,
    role: value(values.cargo),
    discipline: value(values.disciplina),
  };
  const [insights, options, personal] = await Promise.all([getGlobalQuestionInsights(filters), listStatisticsFilterOptions(), getPersonalStudyOverview()]);
  return <>
    <header className="page-header"><div><h1>Estatísticas</h1><p>Leitura da base classificada com recorte explícito, tamanho de amostra e origem nas provas oficiais.</p></div></header>
    <div className="statistics-ledger">
      <div><FileCheck2 size={17} /><span>Provas analisadas</span><strong className="numeric">{insights.proofCount}</strong></div>
      <div><SearchCheck size={17} /><span>Questões elegíveis</span><strong className="numeric">{insights.sampleSize}</strong></div>
      <div><BarChart3 size={17} /><span>Assuntos classificados</span><strong className="numeric">{insights.subjects.length}</strong></div>
    </div>
    <form className="statistics-filters" action="/estatisticas">
      <label><span>Banca</span><select name="banca" defaultValue={filters.board ?? ""}><option value="">Todas</option>{options.boards.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Ano</span><select name="ano" defaultValue={filters.year ?? ""}><option value="">Todos</option>{options.years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>Cargo</span><select name="cargo" defaultValue={filters.role ?? ""}><option value="">Todos</option>{options.roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>Disciplina</span><select name="disciplina" defaultValue={filters.discipline ?? ""}><option value="">Todas</option>{options.disciplines.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <button className="button button--primary" type="submit">Atualizar recorte</button>
      {Object.values(filters).some(Boolean) && <Link className="statistics-filters__reset" href="/estatisticas">Limpar</Link>}
    </form>
    {insights.sampleSize ? <>
      {insights.isSmallSample && <p className="sample-warning">Amostra pequena: {insights.sampleSize} questões. Interprete as proporções com cautela; o mínimo editorial é {insights.minimumSampleSize}.</p>}
      <div className="statistics-grid">
        <section className="panel"><header className="panel__header"><div><h2>Disciplinas</h2><p>Participação no conjunto elegível do recorte.</p></div><span className="numeric">n={insights.sampleSize}</span></header><RankedBars items={insights.disciplines} limit={12} /></section>
        <section className="panel"><header className="panel__header"><div><h2>Assuntos mais frequentes</h2><p>Somente classificações automáticas de alta confiança ou confirmadas.</p></div><span className="numeric">n={insights.subjects.reduce((sum, item) => sum + item.count, 0)}</span></header><RankedBars items={insights.subjects} limit={12} /></section>
      </div>
    </> : <div className="panel"><EmptyState title="Nenhuma questão elegível neste recorte." description="Ajuste os filtros ou aguarde novas provas classificadas com confiança suficiente." /></div>}
    {personal.authenticated && <section className="personal-comparison" id="meu-desempenho"><header><div><span className="eyebrow">Privado · somente você</span><h2>Incidência geral × seu desempenho</h2><p>A incidência vem das provas; seu desempenho usa a tentativa válida mais recente por questão.</p></div><span className="sample-chip">{personal.history.answeredQuestions} questões únicas</span></header>
      {personal.history.attempts ? <div className="comparison-table" role="table" aria-label="Comparação de incidência e desempenho"><div className="comparison-table__head" role="row"><span>Disciplina</span><span>Nas provas analisadas</span><span>Seu domínio atual</span><span>Prioridade</span></div>{insights.disciplines.map((global) => {
        const performance = personal.disciplines.find((item) => item.id === global.id);
        const priority = personal.priorities.find((item) => item.id === global.id);
        return <div className="comparison-table__row" role="row" key={global.id}><strong>{global.label}</strong><span><b className="numeric">{global.percentage.toLocaleString("pt-BR")}%</b><small>n={global.count}</small></span><span><b className="numeric">{formatPercent(performance?.accuracy ?? null)}</b><small>{performance?.answered ?? 0} respondidas</small></span><span className={`priority-label priority-label--${(priority?.priority ?? "NOT_ENOUGH_DATA").toLowerCase()}`}>{priority?.priority === "HIGH" ? "Alta" : priority?.priority === "MEDIUM" ? "Média" : priority?.priority === "LOW" ? "Baixa" : "Sem prioridade"}</span></div>;
      })}</div> : <EmptyState title="Você ainda não respondeu questões" description="A comparação aparecerá depois das primeiras respostas; prioridade exige ao menos cinco questões no recorte." />}
    </section>}
  </>;
}
