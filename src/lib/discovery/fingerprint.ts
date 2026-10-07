import { createHash } from "node:crypto";
import { normalizeEntityName } from "@/lib/utils/normalization";
import type { DiscoveryEventType } from "./types";

export function buildEventFingerprint(input: { orgao: string; uf?: string | null; eventType: DiscoveryEventType; eventDate: string; temporalWindowDays?: number }) {
  const date = Date.parse(`${input.eventDate.slice(0, 10)}T00:00:00Z`);
  const windowDays = input.temporalWindowDays ?? 7;
  const temporalBucket = Number.isFinite(date) ? Math.floor(date / (windowDays * 86_400_000)) : input.eventDate.slice(0, 10);
  const canonical = [normalizeEntityName(input.orgao), input.uf?.toUpperCase() ?? "", input.eventType, temporalBucket].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
