import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BellPlus, ExternalLink } from "lucide-react";
import { getConcurso } from "@/features/concursos/data/repository";
import { followCompetition } from "@/features/concursos/actions";
import { ConfidenceBadge, StatusBadge } from "@/components/ui/status-badge";
import { MockNotice } from "@/components/ui/mock-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";
import { DocumentActions } from "@/components/documents/document-actions";
import { RankedBars } from "@/components/questions/ranked-bars";
import { getContestQuestionInsights } from "@/features/questions/data/repository";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getConcurso(slug);
  if (!item) return { title: "Concurso não encontrado", robots: { index: false, follow: false } };
  const description = item.descricao ?? `${item.orgao.nome}: status, fontes, histórico, documentos e provas verificadas.`;
  return {
    title: item.titulo,
    description,
    alternates: { canonical: `/concursos/${item.slug}` },
    openGraph: { title: item.titulo, description, type: "article", url: `/concursos/${item.slug}` },
  };
}

export default async function ConcursoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, insights] = await Promise.all([getConcurso(slug), getContestQuestionInsights(slug)]);
  if (!item) notFound();
  const evidence = [...new Map(item.movimentos.flatMap((movement) => movement.sources).map((source) => [source.url, source])).values()];
  const answerKeys = item.provas.flatMap((proof) => proof.answerKeys.map((answer) => ({ ...answer, proofTitle: proof.title })));

  return <>
    {item.isMock && <MockNotice />}
    <section className="detail-hero">
      <div className="detail-hero__top">
        <div><div className="page-actions"><StatusBadge status={item.status} /><ConfidenceBadge confidence={item.confidence} /></div><h1>{item.titulo}</h1><p>{item.descricao ?? "Dados ainda não disponíveis."}</p></div>
        {item.isMock ? <button className="button button--primary" disabled title="Ação indisponível em dados MOCK"><BellPlus size={17} /> Acompanhar</button> : <form action={followCompetition}><input type="hidden" name="concursoId" value={item.id} /><input type="hidden" name="slug" value={item.slug} /><button className="button button--primary" type="submit"><BellPlus size={17} /> Acompanhar</button></form>}
      </div>
      <div className="detail-meta"><span><strong>Órgão:</strong> {item.orgao.nome}</span><span><strong>Local:</strong> {[item.cidade, item.uf].filter(Boolean).join(" · ") || "Brasil"}</span>{item.officialUrl && <Link href={item.officialUrl} target="_blank" rel="noopener noreferrer"><strong>Fonte oficial</strong> <ExternalLink size={13} /></Link>}</div>
    </section>
    <nav className="tabs" aria-label="Seções do concurso"><a href="#visao-geral">Visão geral</a><a href="#movimentacoes">Movimentações</a><a href="#cargos">Cargos</a><a href="#editais">Editais</a><a href="#provas">Provas</a><a href="#gabaritos">Gabaritos</a><a href="#notas-corte">Notas de corte</a><a href="#documentos">Documentos</a><a href="#concorrencia">Concorrência</a><a href="#estatisticas">Estatísticas</a><a href="#fontes">Fontes</a></nav>
    <div className="overview-grid">
      <section className="panel" id="visao-geral"><header className="panel__header"><h2>Visão geral</h2></header><dl className="facts"><div className="fact"><dt>Vagas</dt><dd className="numeric">{formatNumber(item.vagasTotal)}</dd></div><div className="fact"><dt>Remuneração</dt><dd className="numeric">{item.salarioMax ? `até ${formatCurrency(item.salarioMax)}` : "Não informado"}</dd></div><div className="fact"><dt>Banca</dt><dd>{item.banca ?? "Não informado"}</dd></div><div className="fact"><dt>Escolaridade</dt><dd>{item.escolaridadeResumo ?? "Não informado"}</dd></div><div className="fact"><dt>Inscrições</dt><dd className="numeric">{item.inicioInscricoes ? `${formatDate(item.inicioInscricoes)} a ${formatDate(item.fimInscricoes)}` : "Não informado"}</dd></div><div className="fact"><dt>Data da prova</dt><dd className="numeric">{formatDate(item.dataProva)}</dd></div></dl></section>
      <section className="panel" id="movimentacoes"><header className="panel__header"><h2>Movimentações</h2></header><div className="timeline">{item.movimentos.length ? item.movimentos.map((movement) => <article className="timeline-item" key={movement.id}><span className="timeline-dot" /><div><h3>{movement.titulo}</h3><p>{movement.descricao ?? "Sem descrição adicional."}</p><ConfidenceBadge confidence={movement.confidence} />{movement.sourceUrl && <Link className="movement-source" href={movement.sourceUrl} target="_blank" rel="noopener noreferrer">{movement.sources.length} {movement.sources.length === 1 ? "fonte" : "fontes"} vinculada{movement.sources.length === 1 ? "" : "s"} <ExternalLink size={12} /></Link>}</div><time dateTime={movement.occurredAt ?? movement.eventDate}>{formatDate(movement.occurredAt ?? movement.eventDate)}</time></article>) : <EmptyState title="Sem histórico" description="Nenhuma movimentação foi registrada ainda." />}</div></section>
    </div>
    <div className="data-section-grid">
      <section className="panel" id="cargos"><header className="panel__header"><h2>Cargos</h2></header>{item.cargos.length ? <div className="simple-list">{item.cargos.map((cargo) => <div key={cargo.id}><strong>{cargo.nome}</strong><span>{formatNumber(cargo.vagas)} vagas · {formatCurrency(cargo.salarioInicial)}</span></div>)}</div> : <EmptyState title="Cargos ainda não informados" />}</section>
      <section className="panel" id="editais"><header className="panel__header"><h2>Editais</h2><span className="numeric">{item.editais.length}</span></header>{item.editais.length ? <div className="document-list">{item.editais.map((document) => <article className="document-row" key={document.id}><div className="document-row__copy"><strong>{document.title}</strong><span>{[document.type, document.number, document.year].filter(Boolean).join(" · ")}</span><small>Publicado em {formatDate(document.publishedAt)} · {document.sourceName ?? "Fonte oficial"}</small></div><DocumentActions storageUrl={document.storageUrl} sourceUrl={document.sourceUrl} title={document.title} /></article>)}</div> : <EmptyState title="Nenhum edital armazenado." />}</section>
      <section className="panel" id="provas"><header className="panel__header"><h2>Provas anteriores</h2><span className="numeric">{item.provas.length}</span></header>{item.provas.length ? <div className="document-list">{item.provas.map((proof) => <article className="document-row" key={proof.id}><div className="document-row__copy"><strong>{proof.title}</strong><span>{[proof.year, proof.role, proof.board].filter(Boolean).join(" · ")}</span><small>{proof.questionCount ? `${proof.questionCount} questões` : "Quantidade de questões não informada"}{proof.extractionStatus === "SCANNED" ? " · PDF sem camada de texto" : ""}</small></div><DocumentActions storageUrl={proof.storageUrl} sourceUrl={proof.sourceUrl} title={proof.title} /></article>)}</div> : <EmptyState title="Nenhuma prova anterior encontrada." />}</section>
      <section className="panel" id="gabaritos"><header className="panel__header"><h2>Gabaritos</h2><span className="numeric">{answerKeys.length}</span></header>{answerKeys.length ? <div className="document-list">{answerKeys.map((answer) => <article className="document-row" key={answer.id}><div className="document-row__copy"><strong>{answer.title}</strong><span>{answer.type} · {answer.proofTitle}</span><small>Publicado em {formatDate(answer.publishedAt)}</small></div><DocumentActions storageUrl={answer.storageUrl} sourceUrl={answer.sourceUrl} title={answer.title} /></article>)}</div> : <EmptyState title="Nenhum gabarito armazenado." />}</section>
      <section className="panel" id="notas-corte"><header className="panel__header"><div><h2>Notas de corte</h2><p>Somente valores explicitamente publicados em documento verificável.</p></div><span className="numeric">{item.notasCorte.length}</span></header>{item.notasCorte.length ? <div className="simple-list">{item.notasCorte.map((cutoff) => <div key={cutoff.id}><strong className="numeric">{cutoff.score.toLocaleString("pt-BR")}</strong><span>{[cutoff.role, cutoff.modality.replaceAll("_", " "), cutoff.year, cutoff.classification ? `${cutoff.classification}ª classificação` : null].filter(Boolean).join(" · ")}</span>{cutoff.sourceUrl && <Link href={cutoff.sourceUrl} target="_blank" rel="noopener noreferrer">{cutoff.sourceName ?? "Abrir fonte oficial"} <ExternalLink size={12} /></Link>}</div>)}</div> : <EmptyState title="Nenhuma nota de corte oficial encontrada." description="O Radar não exibe estimativas como se fossem resultados oficiais." />}</section>
      <section className="panel" id="documentos"><header className="panel__header"><h2>Outros documentos</h2><span className="numeric">{item.documentos.length}</span></header>{item.documentos.length ? <div className="document-list">{item.documentos.map((document) => <article className="document-row" key={document.id}><div className="document-row__copy"><strong>{document.title}</strong><span>{document.kind}</span><small>Publicado em {formatDate(document.publishedAt)}</small></div><DocumentActions storageUrl={document.storageUrl} sourceUrl={document.sourceUrl} title={document.title} /></article>)}</div> : <EmptyState title="Nenhum outro documento armazenado." />}</section>
      <section className="panel" id="concorrencia"><header className="panel__header"><h2>Concorrência</h2></header><EmptyState title="Dados ainda não disponíveis" /></section>
      <section className="panel" id="fontes"><header className="panel__header"><h2>Fontes e evidências</h2><span className="numeric">{evidence.length}</span></header>{evidence.length ? <div className="evidence-list">{evidence.map((source) => <article className="evidence-row" key={source.url}><div className="evidence-row__copy"><strong>{source.title ?? source.name}</strong><span>{source.name}</span><span className="evidence-type">{source.rankingTier ?? source.type}</span></div><div className="evidence-row__meta"><time dateTime={source.publishedAt ?? undefined}>{formatDate(source.publishedAt)}</time><ConfidenceBadge confidence={source.confidence} /></div><Link className="evidence-row__link" href={source.url} target="_blank" rel="noopener noreferrer">Abrir fonte <ExternalLink size={12} /></Link></article>)}</div> : <EmptyState title="Nenhuma evidência vinculada" description="As fontes aparecerão aqui quando uma coleta verificar uma movimentação deste concurso." />}</section>
    </div>
    <section id="estatisticas" className="statistics-section"><h2 className="section-title">O que mais caiu nas provas anteriores</h2>{insights.sampleSize >= insights.minimumSampleSize ? <div className="contest-insights"><div className="contest-insights__summary"><strong className="numeric">{insights.sampleSize}</strong><span>questões elegíveis em {insights.proofCount} {insights.proofCount === 1 ? "prova" : "provas"}</span><p>Percentuais calculados somente sobre classificações confirmadas ou automáticas de alta confiança.</p></div><RankedBars items={insights.subjects} limit={8} /></div> : <div className="insight-empty"><strong>Dados insuficientes para gerar análise.</strong>A base atual tem {insights.sampleSize} questões elegíveis; o mínimo editorial é {insights.minimumSampleSize}.</div>}</section>
  </>;
}
