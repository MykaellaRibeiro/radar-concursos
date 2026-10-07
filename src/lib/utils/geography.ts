export type BrazilianRegion = "NORTE" | "NORDESTE" | "CENTRO_OESTE" | "SUDESTE" | "SUL" | "NACIONAL";

const regionsByState: Record<string, BrazilianRegion> = {
  AC: "NORTE", AP: "NORTE", AM: "NORTE", PA: "NORTE", RO: "NORTE", RR: "NORTE", TO: "NORTE",
  AL: "NORDESTE", BA: "NORDESTE", CE: "NORDESTE", MA: "NORDESTE", PB: "NORDESTE", PE: "NORDESTE",
  PI: "NORDESTE", RN: "NORDESTE", SE: "NORDESTE", DF: "CENTRO_OESTE", GO: "CENTRO_OESTE",
  MT: "CENTRO_OESTE", MS: "CENTRO_OESTE", ES: "SUDESTE", MG: "SUDESTE", RJ: "SUDESTE", SP: "SUDESTE",
  PR: "SUL", RS: "SUL", SC: "SUL",
};

export function regionFromUf(uf: string | null): BrazilianRegion | null {
  return uf ? regionsByState[uf] ?? null : null;
}
