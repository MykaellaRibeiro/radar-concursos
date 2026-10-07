import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY.");
}

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } } as const;
const admin = createClient(url, serviceRoleKey, clientOptions);
const anonymous = createClient(url, publishableKey, clientOptions);
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `Radar-${randomBytes(12).toString("base64url")}!9a`;
const emailA = `radar-validation-a-${suffix}@wolfgestao.com`;
const emailB = `radar-validation-b-${suffix}@wolfgestao.com`;
const createdUserIds: string[] = [];

function authenticatedClient(accessToken: string): SupabaseClient {
  return createClient(url!, publishableKey!, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function requireSession(email: string) {
  const client = createClient(url!, publishableKey!, clientOptions);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error(`Sessão não criada para ${email}.`);
  return { client, session: data.session };
}

async function cleanupUser(id: string) {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) console.error(`Falha ao remover usuário temporário ${id}: ${error.message}`);
}

async function main() {
try {
  const firstUser = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
    user_metadata: { nome: "Validação Radar A" },
  });
  if (firstUser.error || !firstUser.data.user) throw firstUser.error ?? new Error("Primeiro usuário temporário não foi criado.");
  createdUserIds.push(firstUser.data.user.id);

  const secondUser = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
    user_metadata: { nome: "Validação Radar B" },
  });
  if (secondUser.error || !secondUser.data.user) throw secondUser.error ?? new Error("Segundo usuário temporário não foi criado.");
  createdUserIds.push(secondUser.data.user.id);

  const [loginA, loginB] = await Promise.all([requireSession(emailA), requireSession(emailB)]);
  const userA = authenticatedClient(loginA.session.access_token);
  const userB = authenticatedClient(loginB.session.access_token);

  const [profileA, profileB, hiddenProfile, catalog, hiddenAnonymousProfiles, forbiddenCatalogWrite] = await Promise.all([
    userA.from("profiles").select("id, nome").eq("id", firstUser.data.user.id).single(),
    userB.from("profiles").select("id, nome").eq("id", secondUser.data.user.id).single(),
    userB.from("profiles").select("id").eq("id", firstUser.data.user.id),
    anonymous.from("concursos").select("id", { count: "exact", head: true }),
    anonymous.from("profiles").select("id").limit(1),
    anonymous.from("concursos").insert({ titulo: "NÃO DEVE SER INSERIDO" }),
  ]);

  if (profileA.error || profileA.data?.nome !== "Validação Radar A") throw profileA.error ?? new Error("Profile A não foi criado pelo trigger.");
  if (profileB.error || profileB.data?.nome !== "Validação Radar B") throw profileB.error ?? new Error("Profile B não foi criado pelo trigger.");
  if (hiddenProfile.error || hiddenProfile.data.length !== 0) throw hiddenProfile.error ?? new Error("Usuário B conseguiu ler o profile do usuário A.");
  if (catalog.error || (catalog.count ?? 0) < 470) throw catalog.error ?? new Error(`Catálogo público retornou ${catalog.count}, esperado ao menos 470.`);
  if (!hiddenAnonymousProfiles.error) throw new Error("Anon conseguiu ler profiles.");
  if (!forbiddenCatalogWrite.error) throw new Error("Anon conseguiu escrever no catálogo.");

  const alertInsert = await userA.from("alertas").insert({ user_id: firstUser.data.user.id, nome: "Validação RLS temporária" }).select("id").single();
  if (alertInsert.error || !alertInsert.data) throw alertInsert.error ?? new Error("Usuário A não conseguiu criar alerta próprio.");

  const [ownerRead, otherRead, otherUpdate] = await Promise.all([
    userA.from("alertas").select("id").eq("id", alertInsert.data.id),
    userB.from("alertas").select("id").eq("id", alertInsert.data.id),
    userB.from("alertas").update({ nome: "Tentativa indevida" }).eq("id", alertInsert.data.id).select("id"),
  ]);
  if (ownerRead.error || ownerRead.data.length !== 1) throw ownerRead.error ?? new Error("Usuário A não leu o próprio alerta.");
  if (otherRead.error || otherRead.data.length !== 0) throw otherRead.error ?? new Error("Usuário B leu alerta do usuário A.");
  if (otherUpdate.error || otherUpdate.data.length !== 0) throw otherUpdate.error ?? new Error("Usuário B alterou alerta do usuário A.");

  const ownerDelete = await userA.from("alertas").delete().eq("id", alertInsert.data.id).select("id");
  if (ownerDelete.error || ownerDelete.data.length !== 1) throw ownerDelete.error ?? new Error("Usuário A não removeu o próprio alerta temporário.");

  const [logoutA, logoutB] = await Promise.all([loginA.client.auth.signOut(), loginB.client.auth.signOut()]);
  if (logoutA.error || logoutB.error) throw logoutA.error ?? logoutB.error;

  console.log(JSON.stringify({
    userProvisioning: "ok",
    login: "ok",
    logout: "ok",
    profileTrigger: "ok",
    publicCatalogCount: catalog.count,
    anonymousProfileAccess: "blocked",
    anonymousCatalogWrite: "blocked",
    ownerAlertCrud: "ok",
    crossUserRead: "blocked",
    crossUserUpdate: "blocked",
  }, null, 2));
} finally {
  for (const id of createdUserIds.reverse()) await cleanupUser(id);
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
