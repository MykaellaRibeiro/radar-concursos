import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";
import type { ConcursoSummary } from "@/types/domain";
import { ConfidenceBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

export function ConcursoList({ items }: { items: ConcursoSummary[] }) {
  if (!items.length) return <EmptyState title="Nenhum concurso encontrado" description="Ajuste os filtros ou aguarde a próxima coleta de fontes verificadas." />;
  return (
    <div className="competition-table-wrap">
      <table className="competition-table">
        <thead><tr><th>Concurso</th><th>Status</th><th>Local</th><th>Vagas</th><th>Remuneração</th><th>Prazo</th><th><span className="sr-only">Abrir</span></th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td><Link href={`/concursos/${item.slug}`} className="competition-name"><span className="org-monogram">{item.orgao.sigla?.slice(0, 3) ?? item.uf ?? "BR"}</span><span><strong>{item.titulo}</strong><small>{item.orgao.nome}</small></span></Link></td>
          <td><StatusBadge status={item.status} /><ConfidenceBadge confidence={item.confidence} /></td>
          <td>{[item.cidade, item.uf].filter(Boolean).join(" · ") || "Brasil"}</td>
          <td className="numeric">{formatNumber(item.vagasTotal)}</td>
          <td className="numeric">{item.salarioMax ? `até ${formatCurrency(item.salarioMax)}` : "Não informado"}</td>
          <td className="numeric">{formatDate(item.fimInscricoes)}</td>
          <td><Link href={`/concursos/${item.slug}`} aria-label={`Abrir ${item.titulo}`} className="row-action"><ArrowUpRight size={18} /></Link></td>
        </tr>)}</tbody>
      </table>
      <div className="competition-cards">{items.map((item) => <article key={item.id} className="competition-card">
        <div className="competition-card__head"><span className="org-monogram">{item.orgao.sigla?.slice(0, 3) ?? item.uf ?? "BR"}</span><StatusBadge status={item.status} /></div>
        <h2><Link href={`/concursos/${item.slug}`}>{item.titulo}</Link></h2>
        <p>{[item.cidade, item.uf].filter(Boolean).join(" · ") || "Brasil"}</p>
        <dl><div><dt>Vagas</dt><dd>{formatNumber(item.vagasTotal)}</dd></div><div><dt>Até</dt><dd>{formatCurrency(item.salarioMax)}</dd></div><div><dt>Prazo</dt><dd>{formatDate(item.fimInscricoes)}</dd></div></dl>
      </article>)}</div>
    </div>
  );
}
