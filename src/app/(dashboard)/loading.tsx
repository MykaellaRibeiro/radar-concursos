export default function DashboardLoading() {
  return <div className="page-loading" role="status" aria-live="polite">
    <span className="page-loading__line page-loading__line--title" />
    <span className="page-loading__line page-loading__line--copy" />
    <div className="page-loading__panel"><span /><span /><span /></div>
    <span className="sr-only">Carregando dados do Radar…</span>
  </div>;
}
