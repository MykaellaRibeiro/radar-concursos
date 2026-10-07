import type { RankedStatistic } from "@/features/questions/data/repository";

export function RankedBars({ items, limit = 8 }: { items: RankedStatistic[]; limit?: number }) {
  const visible = items.slice(0, limit);
  const maximum = Math.max(...visible.map((item) => item.count), 1);
  return <div className="ranked-bars">
    {visible.map((item, index) => <div className="ranked-bar" key={item.id}>
      <div className="ranked-bar__label">
        <span className="numeric">{String(index + 1).padStart(2, "0")}</span>
        <strong>{item.label}</strong>
        <span className="numeric">{item.count} · {item.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
      </div>
      <div className="ranked-bar__track" aria-hidden="true"><span style={{ width: `${Math.max(3, item.count * 100 / maximum)}%` }} /></div>
    </div>)}
  </div>;
}
