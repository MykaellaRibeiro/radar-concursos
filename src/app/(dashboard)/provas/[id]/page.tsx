import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Search } from "lucide-react";
import { DocumentActions } from "@/components/documents/document-actions";
import { RankedBars } from "@/components/questions/ranked-bars";
import { EmptyState } from "@/components/ui/empty-state";
import { getProof } from "@/features/provas/data/repository";
import { getProofQuestionInsights, listProofQuestions } from "@/features/questions/data/repository";
import { formatNumber } from "@/lib/utils/format";

const value = (input: string | string[] | undefined) => typeof input === "string" ? input : undefined;
const statusLabel: Record<string, string> = {
  UNCLASSIFIED: "Não classificada",
  AUTO_CLASSIFIED: "Classificada automaticamente",
  REVIEW_REQUIRED: "Revisão necessária",
  REVIEWED: "Revisada",
  CONFIRMED: "Confirmada",
};

export default async function ProofDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const filters = { discipline: value(query.disciplina), subject: value(query.assunto), status: value(query.status) };
  const [proof, questions, insights] = await Promise.all([
    getProof(id),
    listProofQuestions(id, filters),
    getProofQuestionInsights(id),
  ]);
  if (!proof) notFound();

  return <>
    <Link className="back-link" href="/provas"><ArrowLeft size={15} /> Voltar para provas</Link>
    <header className="detail-hero proof-detail-hero"><div className="detail-hero__top"><div><span className="proof-year numeric">{proof.year ?? "Ano não informado"}</span><h1>{proof.title}</h1><p>{proof.contestTitle} · {proof.organization}</p></div><DocumentActions storageUrl={proof.storageUrl} sourceUrl={proof.sourceUrl} title={proof.title} /></div></header>
    <div className="overview-grid">
      <section className="panel"><header className="panel__header"><h2>Dados da prova</h2></header><dl className="facts"><div className="fact"><dt>Órgão</dt><dd>{proof.organization}</dd></div><div className="fact"><dt>UF</dt><dd>{proof.state ?? "Não informada"}</dd></div><div className="fact"><dt>Banca</dt><dd>{proof.board ?? "Não informada"}</dd></div><div className="fact"><dt>Cargo</dt><dd>{proof.role ?? "Não informado"}</dd></div><div className="fact"><dt>Questões</dt><dd className="numeric">{formatNumber(proof.questionCount)}</dd></div><div className="fact"><dt>Extração</dt><dd>{proof.extractionStatus === "TEXT" ? "Texto disponível" : proof.extractionStatus === "SCANNED" ? "PDF sem camada de texto" : proof.extractionStatus ?? "Não avaliada"}</dd></div></dl></section>
      <section className="panel"><header className="panel__header"><h2>Gabaritos</h2><span className="numeric">{proof.answerKeys.length}</span></header>{proof.answerKeys.length ? <div className="document-list">{proof.answerKeys.map((answer) => <article className="document-row" key={answer.id}><div className="document-row__copy"><strong>{answer.title}</strong><span>{answer.type}</span></div><DocumentActions storageUrl={answer.storageUrl} sourceUrl={answer.sourceUrl} title={answer.title} /></article>)}</div> : <EmptyState title="Nenhum gabarito armazenado." />}</section>
    </div>

    {insights.disciplines.length > 0 && <section className="panel proof-analysis">
      <header className="panel__header"><div><h2>Distribuição por disciplina</h2><p>{insights.sampleSize} questões classificadas · amostra desta prova</p></div><span className="evidence-stamp"><CheckCircle2 size={14} /> Base verificada</span></header>
      <RankedBars items={insights.disciplines} />
    </section>}

    <section className="question-section">
      <header className="question-section__header"><div><h2>Questões e gabarito</h2><p>{questions.items.length} exibidas de {insights.sampleSize || proof.questionCount || 0} questões analisadas.</p></div></header>
      <form className="question-filters" action={`/provas/${proof.id}`}>
        <div className="question-filter-search"><Search size={16} /><span>Refine a lista</span></div>
        <label><span>Disciplina</span><select name="disciplina" defaultValue={filters.discipline ?? ""}><option value="">Todas</option>{questions.disciplines.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
        <label><span>Assunto</span><select name="assunto" defaultValue={filters.subject ?? ""}><option value="">Todos</option>{questions.subjects.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
        <label><span>Classificação</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Todas</option>{questions.statuses.map((status) => <option value={status} key={status}>{statusLabel[status] ?? status}</option>)}</select></label>
        <button className="button button--secondary button--compact" type="submit">Aplicar</button>
        {(filters.discipline || filters.subject || filters.status) && <Link className="question-filters__reset" href={`/provas/${proof.id}`}>Limpar filtros</Link>}
      </form>
      {questions.items.length ? <div className="question-list">{questions.items.map((question) => <article className="question-row" key={question.id}>
        <div className="question-row__number"><span>Questão</span><strong className="numeric">{String(question.number).padStart(2, "0")}</strong></div>
        <div className="question-row__body"><p>{question.statement}</p><div className="taxonomy-line"><span>{question.discipline?.name ?? "Disciplina não classificada"}</span>{question.subject && <span>{question.subject.name}</span>}{question.subsubject && <span>{question.subsubject.name}</span>}</div></div>
        <div className="question-row__answer">{question.annulled ? <span className="answer-key answer-key--annulled">Anulada</span> : <span className="answer-key"><small>Gabarito</small><strong className="numeric">{question.answer ?? "—"}</strong></span>}<Link href={`/questoes/${question.id}`}>Abrir questão</Link></div>
      </article>)}</div> : <div className="panel"><EmptyState title="Nenhuma questão corresponde aos filtros." description="Remova um ou mais filtros para ampliar a busca nesta prova." /></div>}
    </section>
    {proof.contestSlug && <p className="proof-context-link">Este documento pertence a <Link href={`/concursos/${proof.contestSlug}`}>{proof.contestTitle}</Link>.</p>}
  </>;
}
