export function nextDocumentVersion(previous: { id: string; sha256: string | null; version: number } | null, sha256: string) {
  if (!previous) return { duplicate: false, version: 1, supersedesId: null };
  if (previous.sha256 === sha256) return { duplicate: true, version: previous.version, supersedesId: previous.id };
  return { duplicate: false, version: previous.version + 1, supersedesId: previous.id };
}
