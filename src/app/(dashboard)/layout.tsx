import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userName = process.env.NODE_ENV === "development" ? "Marina" : "Visitante";
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userName = String(data.user?.user_metadata?.nome ?? data.user?.email?.split("@")[0] ?? userName);
  }
  return <div className="app-shell"><div className="desktop-sidebar"><Sidebar /></div><div className="app-frame"><Header userName={userName} /><main className="main-content">{children}</main></div></div>;
}
