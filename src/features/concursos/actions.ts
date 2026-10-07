"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function followCompetition(formData: FormData) {
  const parsed = z.object({ concursoId: z.string().uuid(), slug: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(`/concursos/${parsed.data.slug}`)}`);
  const { error } = await supabase.from("concursos_seguidos").upsert({ user_id: data.user.id, concurso_id: parsed.data.concursoId }, { onConflict: "user_id,concurso_id" });
  if (error) throw new Error("Não foi possível acompanhar este concurso.");
  revalidatePath(`/concursos/${parsed.data.slug}`);
  revalidatePath("/dashboard");
}

export async function removeFollowedCompetition(formData: FormData) {
  const parsed = z.object({ concursoId: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const [targetResult, followResult] = await Promise.all([
    supabase.from("concursos_alvo").delete().eq("user_id", data.user.id).eq("concurso_id", parsed.data.concursoId),
    supabase.from("concursos_seguidos").delete().eq("user_id", data.user.id).eq("concurso_id", parsed.data.concursoId),
  ]);
  if (targetResult.error || followResult.error) throw new Error("Não foi possível remover este concurso.");
  revalidatePath("/meus-concursos");
  revalidatePath("/dashboard");
}
