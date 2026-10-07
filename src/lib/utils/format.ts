export function formatCurrency(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function formatNumber(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number | null, maximumFractionDigits = 1) {
  if (value === null) return "Sem amostra";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits }).format(value);
}

export function competitionRatio(inscritos: number, vagas: number) {
  if (vagas <= 0) return null;
  return inscritos / vagas;
}
