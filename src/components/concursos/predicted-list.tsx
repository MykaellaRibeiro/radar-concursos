import Link from "next/link";
import { ArrowUpRight, Building2, FileSearch, MapPin } from "lucide-react";
import { ConfidenceBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatNumber } from "@/lib/utils/format";
import type { ConcursoSummary } from "@/types/domain";

export function PredictedList({ items }: { items: ConcursoSummary[] }) {
  if (!items.length) return <EmptyState title="Nenhum previsto neste recorte" description="Remova um filtro ou aguarde a próxima coleta de fontes verificadas." />;
  return <div className="predicted-list">
    {items.map((item) => {
      const vacancies = item.vagasPrevistas ?? item.vagasTotal;
      return <article className="predicted-row" key={item.id}>
      <div className="predicted-row__identity">
        <span className="org-monogram">{item.orgao.sigla?.slice(0, 3) ?? item.uf ?? "BR"}</span>
        <div><h2><Link href={`/concursos/${item.slug}`}>{item.titulo}</Link></h2><p>{item.orgao.nome}</p></div>
      </div>
      <div className="predicted-row__state"><StatusBadge status={item.status} /><ConfidenceBadge confidence={item.confidence} /></div>
      <dl className="predicted-row__facts">
        <div><dt><MapPin size={13} /> Local</dt><dd>{[item.cidade, item.uf].filter(Boolean).join(" · ") || "Brasil"}</dd></div>
        <div><dt><Building2 size={13} /> Banca</dt><dd>{item.primaryBoard ?? item.bancaObservacao ?? "Não definida"}</dd></div>
        <div><dt>Vagas previstas</dt><dd className={vacancies !== null ? "numeric" : undefined}>{formatNumber(vacancies)}</dd></div>
      </dl>
      <div className="predicted-row__movement">
        <span><FileSearch size={14} /> Última movimentação</span>
        <strong>{item.latestMovementTitle ?? "Sem movimentação web"}</strong>
        <small>{item.latestMovementDate ? formatDate(item.latestMovementDate) : "Data não informada"} · {item.sourceCount ?? 0} {(item.sourceCount ?? 0) === 1 ? "fonte" : "fontes"}</small>
      </div>
      <Link href={`/concursos/${item.slug}`} className="row-action predicted-row__action" aria-label={`Ver detalhes de ${item.titulo}`}><ArrowUpRight size={18} /></Link>
    </article>;
    })}
  </div>;
}
