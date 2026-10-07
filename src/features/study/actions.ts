"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface AttemptActionState {
  status: "IDLE" | "CORRECT" | "INCORRECT" | "ANNULLED" | "AUTH_REQUIRED" | "ERROR";
  message: string | null;
  selectedOption: string | null;
  officialAnswer: string | null;
  attemptNumber: number | null;
}

const initialAttemptState: AttemptActionState = {
  status: "IDLE",
  message: null,
  selectedOption: null,
  officialAnswer: null,
  attemptNumber: null,
};

const attemptSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.enum(["A", "B", "C", "D", "E"]),
  context: z.enum(["QUESTAO", "ESTUDO", "PROVA", "REVISAO"]).default("QUESTAO"),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
});

export async function submitQuestionAttempt(_previous: AttemptActionState, formData: FormData): Promise<AttemptActionState> {
  const parsed = attemptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...initialAttemptState, status: "ERROR", message: "Selecione uma alternativa válida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ...initialAttemptState, status: "AUTH_REQUIRED", message: "Entre para registrar sua resposta." };

  const { data, error } = await supabase.from("tentativas_questoes").insert({
    user_id: auth.user.id,
    questao_id: parsed.data.questionId,
    alternativa_marcada: parsed.data.selectedOption,
    contexto: parsed.data.context,
    duracao_segundos: parsed.data.durationSeconds,
  }).select("alternativa_marcada,correta,anulada,numero_tentativa,questoes(resposta)").single();
  if (error) {
    console.error("phase6_attempt_insert_failed", { questionId: parsed.data.questionId, code: error.code });
    if (error.code === "P0001" && error.message.includes("rate limit")) {
      return { ...initialAttemptState, status: "ERROR", message: "Aguarde um instante antes de registrar outra resposta." };
    }
    return { ...initialAttemptState, status: "ERROR", message: "A resposta não foi salva. Tente novamente." };
  }
  const official = (data.questoes as unknown as { resposta: string | null } | null)?.resposta ?? null;
  revalidatePath("/dashboard");
  revalidatePath("/estatisticas");
  revalidatePath(`/questoes/${parsed.data.questionId}`);
  return {
    status: data.anulada ? "ANNULLED" : data.correta ? "CORRECT" : "INCORRECT",
    message: data.anulada
      ? "Questão anulada no gabarito oficial. Ela conta para cobertura, mas não para a taxa de acerto."
      : data.correta ? "Resposta correta e salva." : "Resposta incorreta e salva.",
    selectedOption: data.alternativa_marcada,
    officialAnswer: data.anulada ? null : official,
    attemptNumber: data.numero_tentativa,
  };
}

export async function toggleQuestionBookmark(questionId: string, shouldSave: boolean) {
  const parsed = z.string().uuid().safeParse(questionId);
  if (!parsed.success) return { ok: false, saved: false, message: "Questão inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, saved: false, message: "Entre para salvar questões." };
  const result = shouldSave
    ? await supabase.from("questoes_salvas").upsert({ user_id: auth.user.id, questao_id: parsed.data }, { onConflict: "user_id,questao_id" })
    : await supabase.from("questoes_salvas").delete().eq("user_id", auth.user.id).eq("questao_id", parsed.data);
  if (result.error) return { ok: false, saved: !shouldSave, message: "Não foi possível atualizar a questão salva." };
  revalidatePath("/questoes/salvas");
  revalidatePath(`/questoes/${parsed.data}`);
  return { ok: true, saved: shouldSave, message: shouldSave ? "Questão salva." : "Questão removida das salvas." };
}

const targetSchema = z.object({
  concursoId: z.string().uuid(),
  slug: z.string().min(1).max(180),
  primary: z.enum(["true", "false"]).default("true"),
  priority: z.coerce.number().int().min(1).max(5).default(1),
});

export async function setContestTarget(formData: FormData) {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.rpc("definir_concurso_alvo", {
    p_concurso_id: parsed.data.concursoId,
    p_principal: parsed.data.primary === "true",
    p_prioridade: parsed.data.priority,
  });
  if (error) throw new Error("Não foi possível definir o concurso-alvo.");
  revalidatePath("/meus-concursos");
  revalidatePath(`/meus-concursos/${parsed.data.slug}`);
  revalidatePath("/dashboard");
}

export async function removeContestTarget(formData: FormData) {
  const parsed = z.object({ targetId: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from("concursos_alvo").delete().eq("id", parsed.data.targetId).eq("user_id", auth.user.id);
  if (error) throw new Error("Não foi possível remover o concurso-alvo.");
  revalidatePath("/meus-concursos");
  revalidatePath("/dashboard");
}
