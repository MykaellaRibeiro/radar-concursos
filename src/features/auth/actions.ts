"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

const credentials = z.object({ email: z.string().email(), password: z.string().min(8), next: z.string().optional() });

function authError(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(authError("Informe um e-mail válido e uma senha com ao menos 8 caracteres."));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(authError("Não foi possível entrar. Confira suas credenciais."));
  const next = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}

export async function signUp(formData: FormData) {
  const parsed = credentials.extend({ nome: z.string().min(2).max(80) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(authError("Revise seu nome, e-mail e senha."));
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { nome: parsed.data.nome }, emailRedirectTo: `${siteUrl()}/auth/callback` } });
  if (error) redirect(authError("Não foi possível criar a conta."));
  redirect("/login?message=Confira seu e-mail para confirmar o cadastro.");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = z.object({ email: z.string().email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(authError("Informe um e-mail válido."));
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${siteUrl()}/auth/callback?next=/nova-senha` });
  redirect("/login?message=Se houver uma conta com esse e-mail, você receberá as instruções.");
}

export async function updatePassword(formData: FormData) {
  const parsed = z.object({ password: z.string().min(8), confirmation: z.string().min(8) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.password !== parsed.data.confirmation) {
    redirect(`/nova-senha?error=${encodeURIComponent("As senhas devem ser iguais e ter ao menos 8 caracteres.")}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect(`/nova-senha?error=${encodeURIComponent("O link expirou. Solicite uma nova recuperação de senha.")}`);
  await supabase.auth.signOut();
  redirect("/login?message=Senha atualizada. Entre novamente.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
