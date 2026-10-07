import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { PredictedList } from "@/components/concursos/predicted-list";
import { MockNotice } from "@/components/ui/mock-notice";
import { listPredictedConcursos, type ConcursoFilters, type PredictedSort } from "@/features/concursos/data/repository";
import type { ConfidenceLevel, ConcursoStatus } from "@/types/domain";

export const metadata = { title: "Concursos previstos" };

const allowedStatuses = new Set<ConcursoStatus>(["SOLICITADO", "ANUNCIADO", "PREVISTO", "AUTORIZADO", "COMISSAO_FORMADA", "BANCA_EM_DEFINICAO", "BANCA_DEFINIDA", "BANCA_CONTRATADA", "EDITAL_EM_ELABORACAO", "EDITAL_IMINENTE"]);
const allowedConfidence = new Set<ConfidenceLevel>(["LOW", "MEDIUM", "HIGH", "OFFICIAL"]);
const allowedSort = new Set<PredictedSort>(["movement", "advanced", "recent", "state", "organization", "confidence", "sources"]);
const value = (input: string | string[] | undefined) => Array.isArray(input) ? input[0] : input;

export default async function PrevistosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = value(params.status) as ConcursoStatus | undefined;
  const confidence = value(params.confianca) as ConfidenceLevel | undefined;
  const sortValue = value(params.ordenar);
  const sort: PredictedSort = sortValue && allowedSort.has(sortValue as PredictedSort) ? sortValue as PredictedSort : "movement";
  const filters: ConcursoFilters = {
    query: value(params.q), status: status && allowedStatuses.has(status) ? status : undefined,
    state: value(params.uf)?.toUpperCase(), region: value(params.regiao), board: value(params.banca),
    organization: value(params.orgao), confidence: confidence && allowedConfidence.has(confidence) ? confidence : undefined,
    recentOnly: value(params.recentes) === "7d",
  };
  const advancedActive = Boolean(filters.state || filters.region || filters.board || filters.organization || filters.confidence || filters.recentOnly);
  const items = await listPredictedConcursos(filters, sort);
  const latestRecordedTime = Math.max(...items.map((item) => Date.parse(item.latestMovementDate ?? item.updatedAt)).filter(Number.isFinite), 0);
  const movedRecently = items.filter((item) => item.latestMovementDate && Date.parse(item.latestMovementDate) >= latestRecordedTime - 7 * 86_400_000).length;
  const strongEvidence = items.filter((item) => item.confidence === "HIGH" || item.confidence === "OFFICIAL").length;
  const withBoard = items.filter((item) => item.primaryBoard || item.bancaObservacao).length;

  return <>
    <header className="page-header"><div><h1>Concursos previstos</h1><p>Sinais anteriores ao edital, organizados pela movimentação mais recente e sustentados por fontes rastreáveis.</p></div></header>
    {items.some((item) => item.isMock) && <MockNotice />}
    <section className="predicted-summary" aria-label="Resumo dos concursos previstos">
      <div><strong className="numeric">{items.length}</strong><span>no radar previsto</span></div>
      <div><strong className="numeric">{movedRecently}</strong><span>na última janela de 7 dias</span></div>
      <div><strong className="numeric">{strongEvidence}</strong><span>com evidência alta ou oficial</span></div>
      <div><strong className="numeric">{withBoard}</strong><span>com banca identificada</span></div>
    </section>
    <form className="predicted-filters" action="/concursos/previstos">
      <div className="predicted-filters__primary">
        <div className="filter-search"><Search size={17} /><label className="sr-only" htmlFor="predicted-q">Buscar concurso previsto</label><input id="predicted-q" name="q" defaultValue={value(params.q)} placeholder="Órgão, concurso ou local" /></div>
        <label><span className="sr-only">Status</span><select name="status" defaultValue={status ?? ""}><option value="">Todos os status</option><option value="SOLICITADO">Solicitado</option><option value="ANUNCIADO">Anunciado</option><option value="PREVISTO">Previsto</option><option value="AUTORIZADO">Autorizado</option><option value="COMISSAO_FORMADA">Comissão formada</option><option value="BANCA_EM_DEFINICAO">Banca em definição</option><option value="BANCA_DEFINIDA">Banca definida</option><option value="BANCA_CONTRATADA">Banca contratada</option><option value="EDITAL_EM_ELABORACAO">Edital em elaboração</option><option value="EDITAL_IMINENTE">Edital iminente</option></select></label>
        <label><span className="sr-only">Ordenar</span><select name="ordenar" defaultValue={sort}><option value="movement">Movimentação mais recente</option><option value="advanced">Status mais avançado</option><option value="recent">Cadastro mais recente</option><option value="state">UF</option><option value="organization">Órgão</option><option value="confidence">Maior confiança</option><option value="sources">Mais fontes</option></select></label>
        <button className="button button--secondary" type="submit"><SlidersHorizontal size={17} /> Aplicar</button>
      </div>
      <details className="predicted-filters__details" open={advancedActive || undefined}>
        <summary>Filtros detalhados</summary>
        <div className="predicted-filters__advanced">
          <label>UF<input name="uf" defaultValue={filters.state} maxLength={2} autoCapitalize="characters" placeholder="Ex.: BA" /></label>
          <label>Região<select name="regiao" defaultValue={filters.region ?? ""}><option value="">Todas</option><option value="NORTE">Norte</option><option value="NORDESTE">Nordeste</option><option value="CENTRO_OESTE">Centro-Oeste</option><option value="SUDESTE">Sudeste</option><option value="SUL">Sul</option><option value="NACIONAL">Nacional</option></select></label>
          <label>Órgão<input name="orgao" defaultValue={filters.organization} placeholder="Ex.: CODEBA" /></label>
          <label>Banca<input name="banca" defaultValue={filters.board} placeholder="Ex.: AOCP" /></label>
          <label>Confiança<select name="confianca" defaultValue={filters.confidence ?? ""}><option value="">Todas</option><option value="OFFICIAL">Oficial</option><option value="HIGH">Alta</option><option value="MEDIUM">Média</option><option value="LOW">Baixa</option></select></label>
          <label className="filter-checkbox"><input type="checkbox" name="recentes" value="7d" defaultChecked={filters.recentOnly} /><span>Atualizados nos últimos 7 dias</span></label>
        </div>
      </details>
      {Object.values(params).some(Boolean) && <Link className="predicted-filters__reset" href="/concursos/previstos">Limpar filtros</Link>}
    </form>
    <PredictedList items={items} />
  </>;
}
