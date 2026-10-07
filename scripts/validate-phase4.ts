import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Configure as credenciais Supabase públicas e SUPABASE_SERVICE_ROLE_KEY.");
}

const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } } as const;
const admin = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, publishableKey, options);

async function exactCount(table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const tables = ["concursos", "editais", "provas", "gabaritos", "arquivos", "resultados"];
  const counts = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await exactCount(table)])));

  const { data: documents, error: documentsError } = await admin
    .from("arquivos")
    .select("id,tipo,titulo,file_size,sha256,extraction_status,page_count,storage_bucket,storage_path,source_url,concursos(slug)")
    .order("tipo")
    .order("titulo");
  if (documentsError) throw documentsError;

  const { data: catalog, error: catalogError } = await anonymous
    .from("prova_catalog")
    .select("id,concurso_id,titulo,concurso_slug,banca_sigla,ano,storage_bucket,storage_path,gabarito_id,gabarito_storage_path")
    .limit(10);
  if (catalogError || !catalog?.length) throw catalogError ?? new Error("Catálogo público de provas vazio.");

  const proof = catalog[0];
  if (!proof.storage_bucket || !proof.storage_path) throw new Error("Prova sem arquivo persistido no Storage.");

  const { data: publicUrlData } = admin.storage.from(proof.storage_bucket).getPublicUrl(proof.storage_path);
  const storedResponse = await fetch(publicUrlData.publicUrl);
  const storedBytes = new Uint8Array(await storedResponse.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(storedBytes.subarray(0, 5));
  if (!storedResponse.ok || signature !== "%PDF-") {
    throw new Error(`PDF público inválido: HTTP ${storedResponse.status}, assinatura ${signature}.`);
  }

  const { data: extractedFiles, error: extractedFilesError } = await admin
    .from("arquivos")
    .select("id,tipo,sha256,extraction_status,page_count,texto_extraido")
    .eq("storage_path", proof.storage_path)
    .limit(1);
  if (extractedFilesError || !extractedFiles?.length) throw extractedFilesError ?? new Error("Metadados do PDF não encontrados.");
  const extractedFile = extractedFiles[0];
  if (extractedFile.extraction_status !== "TEXT" || !extractedFile.texto_extraido?.trim()) {
    throw new Error("O PDF real não possui texto extraído validado.");
  }

  const dbWriteAttempt = await anonymous.from("arquivos").insert({
    concurso_id: proof.concurso_id,
    tipo: "OUTRO",
    storage_path: "security-probe/blocked.pdf",
    source_url: "https://example.com/security-probe.pdf",
  });
  if (!dbWriteAttempt.error) throw new Error("Anon conseguiu inserir em public.arquivos.");

  const probePath = `security-probe/${Date.now()}.pdf`;
  const probe = new TextEncoder().encode("%PDF-1.4\n% blocked security probe\n%%EOF\n");
  const storageWriteAttempt = await anonymous.storage
    .from("radar-documentos")
    .upload(probePath, probe, { contentType: "application/pdf", upsert: false });
  if (!storageWriteAttempt.error) {
    await admin.storage.from("radar-documentos").remove([probePath]);
    throw new Error("Anon conseguiu gravar no bucket radar-documentos.");
  }

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;

  console.log(JSON.stringify({
    counts,
    documents,
    publicCatalog: {
      readable: true,
      rowsReturned: catalog.length,
      sample: {
        title: proof.titulo,
        contest: proof.concurso_slug,
        board: proof.banca_sigla,
        year: proof.ano,
        answerKeyLinked: Boolean(proof.gabarito_id),
      },
    },
    publicStoredPdf: {
      readable: true,
      status: storedResponse.status,
      contentType: storedResponse.headers.get("content-type"),
      bytes: storedBytes.byteLength,
      signature,
    },
    extraction: {
      status: extractedFile.extraction_status,
      pageCount: extractedFile.page_count,
      sha256: extractedFile.sha256,
      characters: extractedFile.texto_extraido.length,
    },
    security: {
      anonymousDatabaseWrite: "blocked",
      anonymousStorageWrite: "blocked",
      databaseErrorCode: dbWriteAttempt.error.code,
      storageError: storageWriteAttempt.error.message,
    },
    auth: {
      users: users.users.length,
      confirmedUsers: users.users.filter((user) => Boolean(user.email_confirmed_at)).length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
