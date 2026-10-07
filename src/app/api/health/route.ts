import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function version() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)
    ?? process.env.GITHUB_SHA?.slice(0, 12)
    ?? process.env.npm_package_version
    ?? "development";
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ status: "degraded", database: "unconfigured", version: version(), timestamp: checkedAt }, { status: 503 });

  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.from("concursos").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", database: "ok", version: version(), timestamp: checkedAt }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable", version: version(), timestamp: checkedAt }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
