import Link from "next/link";
import { BookOpenCheck, Filter, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { listQuestionFilterOptions, listQuestions } from "@/features/questions/data/repository";
import { listAnsweredQuestionIds, listCurrentErrorIds, listSavedQuestionIds } from "@/features/study/data/repository";

export const metadata = { title: "Estudar questões", robots: { index: false, follow: false } };
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : undefined;

export default async function StudyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const amount = [5, 10, 20, 50].includes(Number(value(params.quantidade))) ? Number(value(params.quantidade)) : 10;
  const order = value(params.ordem) ?? "novas";
  const personalFilter = value(params.situacao) ?? "todas";
  const filters = {
    contest: value(params.concurso), discipline: value(params.disciplina), subject: value(params.assunto),
    subsubject: value(params.subassunto), board: value(params.banca), proof: value(params.prova),
    year: Number(value(params.ano)) || undefined,
  };
  const [allQuestions, options, answeredIds, errorIds, saved] = await Promise.all([
    listQuestions(filters), listQuestionFilterOptions(), listAnsweredQuestionIds(), listCurrentErrorIds(), listSavedQuestionIds(),
  ]);
  const answered = new Set(answeredIds);
  const errors = new Set(errorIds);
  const savedIds = new Set(saved.ids);
  let questions = allQuestions.filter((question) => {
    if (personalFilter === "respondidas") return answered.has(question.id);
    if (personalFilter === "nao-respondidas") return !answered.has(question.id);
    if (personalFilter === "erros") return errors.has(question.id);
    if (personalFilter === "salvas") return savedIds.has(question.id);
    return true;
  });
  if (order === "novas") questions.sort((a, b) => Number(answered.has(a.id)) - Number(answered.has(b.id)) || a.number - b.number);
  if (order === "erros") questions.sort((a, b) => Number(errors.has(b.id)) - Number(errors.has(a.id)) || a.number - b.number);
  if (order === "aleatoria") questions.sort((a, b) => a.id.slice(-8).localeCompare(b.id.slice(-8)));
  questions = questions.slice(0, amount);
  const personalLocked = ["respondidas", "nao-respondidas", "erros", "salvas"].includes(personalFilter) && !saved.authenticated;
  return <>
    <header className="page-header"><div><span className="eyebrow">Acervo real</span><h1>Estudar questões</h1><p>Monte um recorte sem gerar conteúdo fictício. Quando a quantidade pedida não existir, mostramos somente o que está disponível.</p></div><Link className="button button--secondary" href="/questoes/salvas">Questões salvas</Link></header>
    <form className="study-builder" action="/estudar">
      <div className="study-builder__lead"><Filter size={18} /><div><strong>Montar estudo</strong><span>Não respondidas primeiro é a ordem recomendada.</span></div></div>
      <label><span>Concurso</span><select name="concurso" defaultValue={filters.contest ?? ""}><option value="">Todos</option>{options.contests.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Disciplina</span><select name="disciplina" defaultValue={filters.discipline ?? ""}><option value="">Todas</option>{options.disciplines.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Assunto</span><select name="assunto" defaultValue={filters.subject ?? ""}><option value="">Todos</option>{options.subjects.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Subassunto</span><select name="subassunto" defaultValue={filters.subsubject ?? ""}><option value="">Todos</option>{options.subsubjects.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Banca</span><select name="banca" defaultValue={filters.board ?? ""}><option value="">Todas</option>{options.boards.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Ano</span><select name="ano" defaultValue={filters.year ?? ""}><option value="">Todos</option>{options.years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>Prova</span><select name="prova" defaultValue={filters.proof ?? ""}><option value="">Todas</option>{options.proofs.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>Situação</span><select name="situacao" defaultValue={personalFilter}><option value="todas">Todas</option><option value="nao-respondidas">Questões novas</option><option value="erros">Revisar meus erros</option><option value="respondidas">Respondidas</option><option value="salvas">Salvas</option></select></label>
      <label><span>Ordem</span><select name="ordem" defaultValue={order}><option value="novas">Não respondidas primeiro</option><option value="recentes">Mais recentes</option><option value="erros">Erros atuais primeiro</option><option value="aleatoria">Aleatória estável</option></select></label>
      <label><span>Quantidade</span><select name="quantidade" defaultValue={amount}>{[5, 10, 20, 50].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button className="button button--primary" type="submit">Aplicar recorte</button>
    </form>
    {personalLocked ? <section className="panel"><EmptyState title="Entre para usar filtros pessoais" description="Erros, respostas e salvas são dados privados da sua conta." /><div className="empty-state-action"><Link className="button button--primary" href={`/login?next=${encodeURIComponent("/estudar")}`}><LockKeyhole size={16} /> Entrar</Link></div></section>
      : questions.length ? <section className="study-results"><header><div><BookOpenCheck size={18} /><h2>Fila de estudo</h2></div><span>{questions.length} de {allQuestions.length} disponíveis neste recorte</span></header><div className="study-question-list">{questions.map((question, index) => <Link href={`/questoes/${question.id}`} key={question.id}><span className="numeric">{String(index + 1).padStart(2, "0")}</span><div><strong>{question.discipline?.name ?? "Sem disciplina confirmada"}</strong><p>{question.statement}</p><small>{[question.subject?.name, question.boardName, question.year].filter(Boolean).join(" · ")}</small></div><span>{answered.has(question.id) ? errors.has(question.id) ? "Erro atual" : "Respondida" : "Nova"}</span></Link>)}</div></section>
        : <section className="panel"><EmptyState title="Nenhuma questão disponível neste recorte" description="Remova filtros ou reduza a especificidade. O Radar não cria questões para completar a quantidade." /></section>}
  </>;
}

