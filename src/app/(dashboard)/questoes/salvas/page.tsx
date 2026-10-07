import Link from "next/link";
import { ArrowUpRight, BookmarkCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { listQuestions } from "@/features/questions/data/repository";
import { listSavedQuestionIds } from "@/features/study/data/repository";

export const metadata = { title: "Questões salvas", robots: { index: false, follow: false } };

export default async function SavedQuestionsPage() {
  const saved = await listSavedQuestionIds();
  if (!saved.authenticated) return <><header className="page-header"><div><h1>Questões salvas</h1><p>Sua lista privada para revisão independente do resultado.</p></div></header><section className="panel"><EmptyState title="Entre para ver questões salvas" description="A lista é privada e protegida pela sua sessão." /><div className="empty-state-action"><Link className="button button--primary" href="/login?next=/questoes/salvas">Entrar</Link></div></section></>;
  const questions = await listQuestions({}, saved.ids);
  return <>
    <header className="page-header"><div><span className="eyebrow"><BookmarkCheck size={14} /> Revisão pessoal</span><h1>Questões salvas</h1><p>Uma fila privada, sem alterar seu histórico de respostas.</p></div><Link className="button button--primary" href="/estudar?situacao=salvas">Estudar salvas</Link></header>
    {questions.length ? <div className="saved-question-list">{questions.map((question) => <article key={question.id}><span className="question-number numeric">{String(question.number).padStart(2, "0")}</span><div><strong>{question.discipline?.name ?? "Sem disciplina confirmada"}</strong><p>{question.statement}</p><small>{[question.subject?.name, question.proofTitle, question.year].filter(Boolean).join(" · ")}</small></div><Link href={`/questoes/${question.id}`} aria-label={`Abrir questão ${question.number}`}><ArrowUpRight size={18} /></Link></article>)}</div>
      : <section className="panel"><EmptyState title="Nenhuma questão salva" description="Use “Salvar questão” durante a resolução para montar sua fila de revisão." /><div className="empty-state-action"><Link className="button button--primary" href="/estudar">Encontrar questões</Link></div></section>}
  </>;
}

