export function normalizeDocumentLabel(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

export function isConfidentContestMatch(candidate: { organization: string; state: string; year: number | null }, contest: { organization: string; state: string | null; title: string }) {
  const organization = normalizeDocumentLabel(candidate.organization);
  const haystack = normalizeDocumentLabel(`${contest.organization} ${contest.title}`);
  return Boolean(candidate.state && contest.state === candidate.state && organization.length >= 5 && haystack.includes(organization));
}
