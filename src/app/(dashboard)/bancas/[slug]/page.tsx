import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getBoard } from "@/features/bancas/data/repository";
import { listProofs } from "@/features/provas/data/repository";
import { getBoardQuestionInsights } from "@/features/questions/data/repository";
import { DocumentActions } from "@/components/documents/document-actions";
import { RankedBars } from "@/components/questions/ranked-bars";
import { EmptyState } from "@/components/ui/empty-state";

export default async function BoardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoard(slug);
  if (!board) notFound();
  const [catalog, insights] = await Promise.all([listProofs({ board: slug }), getBoardQuestionInsights(slug)]);
  return <>
    <Link className="back-link" href="/bancas"><ArrowLeft size={15} /> Voltar para bancas</Link>
    <header className="page-header board-header"><div><h1>{board.name}</h1><p>{board.acronym ?? "Banca organizadora"} · dados documentais reais armazenados no Radar.</p></div>{board.site && <Link className="button button--secondary" href={board.site} target="_blank" rel="noopener noreferrer">Site da banca <ExternalLink size={15} /></Link>}</header>
    <div className="board-metrics"><div><strong className="numeric">{board.proofCount}</strong><span>provas armazenadas</span></div><div><strong className="numeric">{insights.sampleSize}</strong><span>questões classificadas</span></div><div><strong>{board.years.join(", ") || "—"}</strong><span>anos disponíveis</span></div></div>
    <div className="board-analysis-grid">
      <section className="panel"><header className="panel__header"><div><h2>Distribuição por disciplina</h2><p>{insights.proofCount} {insights.proofCount === 1 ? "prova analisada" : "provas analisadas"} · n={insights.sampleSize}</p></div></header>{insights.disciplines.length ? <RankedBars items={insights.disciplines} /> : <EmptyState title="Ainda não há questões classificadas para esta banca." />}</section>
      <section className="panel"><header className="panel__header"><div><h2>Assuntos recorrentes</h2><p>Apenas classificações elegíveis para estatística.</p></div></header>{insights.subjects.length ? <RankedBars items={insights.subjects} /> : <EmptyState title="Amostra de assuntos ainda indisponível." />}</section>
    </div>
    <section className="panel board-proof-panel"><header className="panel__header"><h2>Provas no acervo</h2><span className="numeric">{catalog.total}</span></header>{catalog.items.length ? <div className="document-list">{catalog.items.map((proof) => <article className="document-row" key={proof.id}><div className="document-row__copy"><strong><Link href={`/provas/${proof.id}`}>{proof.title}</Link></strong><span>{[proof.year, proof.role, proof.organization].filter(Boolean).join(" · ")}</span></div><DocumentActions storageUrl={proof.storageUrl} sourceUrl={proof.sourceUrl} title={proof.title} /></article>)}</div> : <EmptyState title="Nenhuma prova armazenada para esta banca." />}</section>
  </>;
}
