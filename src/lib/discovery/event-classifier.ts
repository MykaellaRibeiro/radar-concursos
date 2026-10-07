import type { ConcursoStatus } from "@/types/domain";
import type { DiscoveryEventType } from "./types";

const rules: Array<[DiscoveryEventType, RegExp]> = [
  ["BANCA_CONTRATADA", /banca.{0,40}(contratad[ao]|contrato assinad[ao])|contrat(?:a|ou).{0,40}banca|(?:assinado\s+)?contrato.{0,35}(?:com\s+a\s+)?banca/i],
  ["BANCA_DEFINIDA", /banca.{0,30}(definid[ao]|escolhid[ao])|define.{0,30}banca/i],
  ["BANCA_EM_DEFINICAO", /banca.{0,35}(em defini[cç][aã]o|a definir)|escolha da banca/i],
  ["COMISSAO_FORMADA", /comiss[aã]o.{0,35}(formad[ao]|institu[ií]d[ao]|organizadora)|institui.{0,35}comiss[aã]o/i],
  ["GRUPO_TRABALHO", /grupo de trabalho/i],
  ["PROJETO_BASICO", /projeto b[aá]sico/i],
  ["CONCURSO_AUTORIZADO", /concurso.{0,35}autorizad[ao]|autoriza.{0,35}concurso/i],
  ["EDITAL_PUBLICADO", /edital.{0,25}(publicad[ao]|lan[cç]ad[ao])|publica.{0,25}edital/i],
  ["EDITAL_IMINENTE", /edital.{0,30}(iminente|a qualquer momento|pr[oó]ximo)/i],
  ["EDITAL_EM_ELABORACAO", /edital.{0,30}(em elabora[cç][aã]o|sendo elaborad[ao])/i],
  ["INSCRICOES_PRORROGADAS", /inscri[cç][oõ]es.{0,30}prorrogad[ao]s?/i],
  ["INSCRICOES_ABERTAS", /inscri[cç][oõ]es.{0,30}(abertas?|come[cç]am|iniciad[ao]s?)/i],
  ["INSCRICOES_ENCERRADAS", /inscri[cç][oõ]es.{0,30}(encerrad[ao]s?|terminam)/i],
  ["RETIFICACAO", /retifica[cç][aã]o|edital retificado/i],
  ["VAGAS_ALTERADAS", /vagas.{0,30}(ampliad[ao]s?|reduzid[ao]s?|alterad[ao]s?)/i],
  ["SALARIO_ALTERADO", /sal[aá]ri[oa]s?.{0,30}(alterad[ao]s?|reajustad[ao]s?)/i],
  ["DATA_PROVA_ALTERADA", /data.{0,20}(da )?prova.{0,30}(alterad[ao]|adiad[ao])|prova.{0,30}(adiad[ao]|nova data)/i],
  ["LOCAL_PROVA", /loca(?:l|is) de prova/i],
  ["PROVA_REALIZADA", /prova.{0,25}realizad[ao]/i],
  ["GABARITO_PUBLICADO", /gabarito.{0,25}(publicad[ao]|divulgad[ao])/i],
  ["RESULTADO_PRELIMINAR", /resultado preliminar/i],
  ["RESULTADO_DEFINITIVO", /resultado definitivo/i],
  ["HOMOLOGACAO", /homologa[cç][aã]o|concurso homologado/i],
  ["CONVOCACAO", /convoca[cç][aã]o|candidatos convocados/i],
  ["NOMEACAO", /nomea[cç][aã]o|candidatos nomeados/i],
  ["CONCURSO_SOLICITADO", /concurso.{0,35}solicitad[ao]|solicita.{0,35}concurso/i],
  ["CONCURSO_ANUNCIADO", /concurso.{0,35}anunciad[ao]|anuncia.{0,35}concurso/i],
  ["CONCURSO_PREVISTO", /concurso.{0,35}previst[ao]|previs[aã]o.{0,35}concurso/i],
];

export function classifyEvent(text: string): DiscoveryEventType | null {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

export function eventToStatus(event: DiscoveryEventType): ConcursoStatus | null {
  const statuses: Partial<Record<DiscoveryEventType, ConcursoStatus>> = {
    CONCURSO_SOLICITADO: "SOLICITADO", CONCURSO_ANUNCIADO: "ANUNCIADO", CONCURSO_PREVISTO: "PREVISTO",
    CONCURSO_AUTORIZADO: "AUTORIZADO", COMISSAO_FORMADA: "COMISSAO_FORMADA", BANCA_EM_DEFINICAO: "BANCA_EM_DEFINICAO",
    BANCA_DEFINIDA: "BANCA_DEFINIDA", BANCA_CONTRATADA: "BANCA_CONTRATADA", EDITAL_EM_ELABORACAO: "EDITAL_EM_ELABORACAO",
    EDITAL_IMINENTE: "EDITAL_IMINENTE", EDITAL_PUBLICADO: "EDITAL_PUBLICADO", INSCRICOES_ABERTAS: "INSCRICOES_ABERTAS",
    INSCRICOES_ENCERRADAS: "INSCRICOES_ENCERRADAS", PROVA_REALIZADA: "PROVA_REALIZADA", GABARITO_PUBLICADO: "GABARITO_PUBLICADO",
    RESULTADO_PRELIMINAR: "RESULTADO_PRELIMINAR", RESULTADO_DEFINITIVO: "RESULTADO_DEFINITIVO", HOMOLOGACAO: "HOMOLOGADO",
    CONVOCACAO: "CONVOCACAO",
  };
  return statuses[event] ?? null;
}
