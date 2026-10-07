import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const collectors = ["pci_collector", "web_discovery", "document_collector"];

async function main() {
  const { data, error } = await client.from("collector_health").select("collector,provider,last_status,last_started_at,last_finished_at,last_success_at,duration_ms,items_found,items_created,items_updated,items_unchanged,items_rejected,error_count,health_status,last_error");
  if (error) throw error;
  const byName = new Map((data ?? []).map((row) => [row.collector, row]));
  console.info(JSON.stringify({
    checkedAt: new Date().toISOString(),
    collectors: collectors.map((collector) => byName.get(collector) ?? { collector, health_status: "NEVER_RUN" }),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
