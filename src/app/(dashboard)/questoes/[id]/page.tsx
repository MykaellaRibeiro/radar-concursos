import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { QuestionInteraction } from "@/components/questions/question-interaction";
import { getNextQuestionId, getQuestion } from "@/features/questions/data/repository";
import { getQuestionPersonalState } from "@/features/study/data/repository";

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const question = await getQuestion((await params).id);
  if (!question) notFound();
  const [personal, nextQuestionId] = await Promise.all([getQuestionPersonalState(question.id), getNextQuestionId(question)]);
  const initialResult = personal.attempt ? {
    status: personal.attempt.anulada ? "ANNULLED" as const : personal.attempt.correta ? "CORRECT" as const : "INCORRECT" as const,
    message: personal.attempt.anulada
      ? "Questão anulada no gabarito oficial. Ela conta para cobertura, mas não para a taxa de acerto."
      : personal.attempt.correta ? "Sua tentativa mais recente está correta." : "Sua tentativa mais recente está incorreta.",
    selectedOption: personal.attempt.alternativa_marcada,
    officialAnswer: personal.attempt.anulada ? null : question.answer,
    attemptNumber: personal.attempt.numero_tentativa,
  } : undefined;
  return <>
    <Link className="back-link" href={`/provas/${question.proofId}`}><ArrowLeft size={15} /> Voltar para a prova</Link>
    <article className="question-detail">
      <header className="question-detail__header">
        <div><span>Questão <strong className="numeric">{String(question.number).padStart(2, "0")}</strong>{question.page ? ` · página ${question.page}` : ""}</span><h1>{question.discipline?.name ?? "Questão sem disciplina confirmada"}</h1><p>{[question.subject?.name, question.subsubject?.name].filter(Boolean).join(" · ") || "Assunto aguardando revisão."}</p></div>
        {personal.attempt
          ? <span className={`question-status-seal question-status-seal--${personal.attempt.anulada ? "annulled" : personal.attempt.correta ? "correct" : "incorrect"}`}>{personal.attempt.anulada ? "Questão anulada" : personal.attempt.correta ? "Domínio atual: correta" : "Domínio atual: incorreta"}<br /><small>Tentativa {personal.attempt.numero_tentativa} preservada</small></span>
          : <span className="question-status-seal">Resposta protegida<br /><small>registre sua tentativa</small></span>}
      </header>
      <section className="question-detail__content">
        <p className="question-statement">{question.statement}</p>
        <QuestionInteraction questionId={question.id} alternatives={question.alternatives} authenticated={personal.authenticated} bookmarked={personal.bookmarked} initialResult={initialResult} nextQuestionId={nextQuestionId} />
      </section>
      <footer className="question-detail__sources">
        <div><strong>Proveniência</strong><span>{question.proofTitle} · {question.boardName ?? "Banca não informada"} · {question.year ?? "Ano não informado"}</span></div>
        <div className="question-source-links">{question.proofSourceUrl && <Link href={question.proofSourceUrl} target="_blank" rel="noopener noreferrer">Caderno oficial <ExternalLink size={13} /></Link>}{question.answerKeySourceUrl && <Link href={question.answerKeySourceUrl} target="_blank" rel="noopener noreferrer">Gabarito oficial <ExternalLink size={13} /></Link>}</div>
      </footer>
    </article>
  </>;
}
