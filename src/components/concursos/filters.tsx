import { Search, SlidersHorizontal } from "lucide-react";

export function Filters({ values = {} }: { values?: Record<string, string | undefined> }) {
  return (
    <form className="filters" action="/concursos">
      <div className="filter-search"><Search size={17} /><label className="sr-only" htmlFor="filter-q">Buscar</label><input id="filter-q" name="q" defaultValue={values.q} placeholder="Órgão, cargo ou cidade" /></div>
      <label><span className="sr-only">Status</span><select name="status" defaultValue={values.status ?? ""}><option value="">Todos os status</option><option value="AUTORIZADO">Autorizado</option><option value="BANCA_DEFINIDA">Banca definida</option><option value="EDITAL_PUBLICADO">Edital publicado</option><option value="INSCRICOES_ABERTAS">Inscrições abertas</option></select></label>
      <label><span className="sr-only">Estado</span><select name="uf" defaultValue={values.uf ?? ""}><option value="">Todos os estados</option><option>CE</option><option>MA</option><option>PE</option><option>PI</option></select></label>
      <button className="button button--secondary" type="submit"><SlidersHorizontal size={17} /> Filtrar</button>
      <details className="advanced-filters"><summary>Mais filtros</summary><div className="advanced-filters__grid">
        <label>Região<select name="regiao" defaultValue={values.regiao ?? ""}><option value="">Todas</option><option>Norte</option><option>Nordeste</option><option>Centro-Oeste</option><option>Sudeste</option><option>Sul</option></select></label>
        <label>Cidade<input name="cidade" defaultValue={values.cidade} placeholder="Ex.: Recife" /></label>
        <label>Área<input name="area" defaultValue={values.area} placeholder="Ex.: Tecnologia" /></label>
        <label>Escolaridade<select name="escolaridade" defaultValue={values.escolaridade ?? ""}><option value="">Todas</option><option>Fundamental</option><option>Médio</option><option>Técnico</option><option>Superior</option></select></label>
        <label>Salário mínimo<input name="salario_min" defaultValue={values.salario_min} inputMode="numeric" placeholder="Ex.: 4000" /></label>
        <label>Banca<input name="banca" defaultValue={values.banca} placeholder="Ex.: FGV" /></label>
      </div></details>
    </form>
  );
}
