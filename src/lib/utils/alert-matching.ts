export interface AlertCriteria {
  uf?: string | null;
  area?: string | null;
  escolaridade?: string | null;
  salarioMin?: number | null;
}

export interface CompetitionCandidate {
  uf?: string | null;
  area?: string | null;
  escolaridade?: string | null;
  salarioMax?: number | null;
}

export function matchesAlert(alert: AlertCriteria, candidate: CompetitionCandidate) {
  if (alert.uf && alert.uf !== candidate.uf) return false;
  if (alert.area && alert.area.toLowerCase() !== candidate.area?.toLowerCase()) return false;
  if (alert.escolaridade && alert.escolaridade.toLowerCase() !== candidate.escolaridade?.toLowerCase()) return false;
  if (alert.salarioMin && (candidate.salarioMax ?? 0) < alert.salarioMin) return false;
  return true;
}
