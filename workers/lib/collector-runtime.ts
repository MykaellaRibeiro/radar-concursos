import type { SupabaseClient } from "@supabase/supabase-js";
import { errorContext, operationalLog } from "../../src/lib/operations/logger";

export type CollectorName = "pci_collector" | "web_discovery" | "document_collector";
export type CollectorFinalStatus = "SUCCESS" | "PARTIAL" | "FAILED";

const switches: Record<CollectorName, string> = {
  pci_collector: "ENABLE_PCI_COLLECTOR",
  web_discovery: "ENABLE_WEB_DISCOVERY",
  document_collector: "ENABLE_DOCUMENT_COLLECTOR",
};

const ttlDefaults: Record<CollectorName, number> = {
  pci_collector: 60 * 45,
  web_discovery: 60 * 60,
  document_collector: 60 * 120,
};

export type CollectorLease = { collector: CollectorName; provider: string; runId: string; ttlSeconds: number };
export type CollectorStart = { state: "acquired"; lease: CollectorLease } | { state: "disabled" | "already_running" };

function enabled(value: string | undefined) {
  return !/^(?:0|false|off|disabled)$/i.test(value ?? "true");
}

export function isCollectorEnabled(name: CollectorName) {
  return enabled(process.env[switches[name]]);
}

function ttlFor(name: CollectorName) {
  const configured = Number(process.env.COLLECTOR_LOCK_TTL_SECONDS);
  return Number.isFinite(configured) ? Math.min(Math.max(Math.trunc(configured), 60), 21_600) : ttlDefaults[name];
}

export async function beginCollectorRun(
  client: SupabaseClient,
  collector: CollectorName,
  provider: string,
  metadata: Record<string, unknown> = {},
): Promise<CollectorStart> {
  if (!isCollectorEnabled(collector)) {
    operationalLog("warn", "collector.disabled", { collector, provider });
    return { state: "disabled" };
  }
  const ttlSeconds = ttlFor(collector);
  const { data, error } = await client.rpc("begin_collector_run", {
    p_collector: collector,
    p_provider: provider,
    p_ttl_seconds: ttlSeconds,
    p_metadata: { ...metadata, owner: process.env.GITHUB_RUN_ID ?? process.env.HOSTNAME ?? "manual" },
  });
  if (error) throw error;
  const result = (data as Array<{ run_status: "acquired" | "already_running"; run_id: string | null }> | null)?.[0];
  if (!result || result.run_status !== "acquired" || !result.run_id) {
    operationalLog("warn", "collector.already_running", { collector, provider });
    return { state: "already_running" };
  }
  const lease = { collector, provider, runId: result.run_id, ttlSeconds };
  operationalLog("info", "collector.started", { collector, provider, runId: lease.runId });
  return { state: "acquired", lease };
}

export async function heartbeatCollectorRun(client: SupabaseClient, lease: CollectorLease) {
  const { data, error } = await client.rpc("heartbeat_collector_run", { p_run_id: lease.runId, p_ttl_seconds: lease.ttlSeconds });
  if (error || data !== true) operationalLog("warn", "collector.heartbeat_failed", { collector: lease.collector, runId: lease.runId, ...errorContext(error) });
}

export async function finishCollectorRun(client: SupabaseClient, lease: CollectorLease, outcome: {
  status: CollectorFinalStatus;
  found?: number;
  created?: number;
  updated?: number;
  unchanged?: number;
  rejected?: number;
  errorCount?: number;
  error?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const details = outcome.error ? errorContext(outcome.error) : {};
  const { data, error } = await client.rpc("finish_collector_run", {
    p_run_id: lease.runId,
    p_status: outcome.status,
    p_items_found: outcome.found ?? 0,
    p_items_created: outcome.created ?? 0,
    p_items_updated: outcome.updated ?? 0,
    p_items_unchanged: outcome.unchanged ?? 0,
    p_items_rejected: outcome.rejected ?? 0,
    p_error_count: outcome.errorCount ?? (outcome.error ? 1 : 0),
    p_error_message: "errorMessage" in details ? details.errorMessage : null,
    p_metadata: { ...outcome.metadata, errorCode: "errorCode" in details ? details.errorCode : undefined },
  });
  if (error || data !== true) throw error ?? new Error("A execução não pôde ser encerrada no registro operacional.");
  operationalLog(outcome.status === "FAILED" ? "error" : outcome.status === "PARTIAL" ? "warn" : "info", "collector.finished", {
    collector: lease.collector,
    provider: lease.provider,
    runId: lease.runId,
    status: outcome.status,
    found: outcome.found ?? 0,
    created: outcome.created ?? 0,
    updated: outcome.updated ?? 0,
    unchanged: outcome.unchanged ?? 0,
    rejected: outcome.rejected ?? 0,
    errorCount: outcome.errorCount ?? (outcome.error ? 1 : 0),
    ...details,
  });
}
