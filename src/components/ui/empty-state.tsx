import { Radar } from "lucide-react";

export function EmptyState({ title = "Nenhum dado disponível", description = "Assim que fontes verificadas forem adicionadas, os registros aparecerão aqui." }: { title?: string; description?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Radar aria-hidden="true" size={24} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
