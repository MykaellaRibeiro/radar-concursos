export function normalizeEntityName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(do|da|de|dos|das)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildDeduplicationKey(input: { orgao: string; uf?: string | null; titulo: string; ano?: number | null; cargos?: string[]; fonte?: string | null }) {
  const parts: Array<string | number> = [normalizeEntityName(input.orgao), input.uf?.toLowerCase() ?? "", normalizeEntityName(input.titulo), input.ano ?? ""];
  if (input.cargos?.length) parts.push(input.cargos.map(normalizeEntityName).sort().join("+"));
  if (input.fonte) parts.push(normalizeEntityName(input.fonte));
  return parts.join(":");
}
