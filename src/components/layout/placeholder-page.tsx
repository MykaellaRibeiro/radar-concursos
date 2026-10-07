import { EmptyState } from "@/components/ui/empty-state";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <><header className="page-header"><div><h1>{title}</h1><p>{description}</p></div></header><div className="panel"><EmptyState title={`${title}: estrutura pronta`} description="Esta área será ativada quando os dados e fluxos correspondentes forem conectados." /></div></>;
}
