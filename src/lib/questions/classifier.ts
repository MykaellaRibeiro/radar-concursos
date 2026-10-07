import type { ParsedQuestion, QuestionClassification, SubjectSeed, SubsubjectSeed } from "./types";

export const QUESTION_CLASSIFIER_VERSION = "pcma-rules-v1.0.2";

interface ClassificationRule {
  disciplineSlug: string;
  pattern: RegExp;
  subject: SubjectSeed;
  subsubject?: SubsubjectSeed;
  reason: string;
}

const subject = (disciplineSlug: string, name: string, slug: string): SubjectSeed => ({ disciplineSlug, name, slug });
const subsubject = (subjectSlug: string, name: string, slug: string): SubsubjectSeed => ({ subjectSlug, name, slug });

const rules: readonly ClassificationRule[] = [
  { disciplineSlug: "lingua-portuguesa", pattern: /referent|pronome|coes[aã]o|elementos sublinhados|mesma fun[cç][aã]o/i, subject: subject("lingua-portuguesa", "Coesão textual", "coesao-textual"), reason: "Marcadores explícitos de referenciação e coesão." },
  { disciplineSlug: "lingua-portuguesa", pattern: /ambiguidade|sentido original|literalmente|significado/i, subject: subject("lingua-portuguesa", "Semântica", "semantica"), reason: "Marcadores explícitos de sentido e ambiguidade." },
  { disciplineSlug: "lingua-portuguesa", pattern: /reescrev|outro modo de/i, subject: subject("lingua-portuguesa", "Reescrita de frases", "reescrita-de-frases"), reason: "Comando explícito de reescrita." },
  { disciplineSlug: "lingua-portuguesa", pattern: /[\s\S]+/, subject: subject("lingua-portuguesa", "Interpretação de textos", "interpretacao-de-textos"), reason: "Questão remanescente do bloco oficial de Língua Portuguesa, centrada na compreensão do texto-base." },

  { disciplineSlug: "legislacao-especifica", pattern: /Lei Estadual n\. 6\.107\/94|Estatuto dos Servidores/i, subject: subject("legislacao-especifica", "Estatuto dos servidores do Maranhão", "estatuto-dos-servidores-do-maranhao"), reason: "Diploma legal citado no enunciado." },
  { disciplineSlug: "legislacao-especifica", pattern: /Constitui[cç][aã]o (?:do Estado|Estadual)/i, subject: subject("legislacao-especifica", "Constituição do Estado do Maranhão", "constituicao-do-estado-do-maranhao"), reason: "Constituição estadual citada no enunciado." },
  { disciplineSlug: "legislacao-especifica", pattern: /Lei Estadual n\. 8\.957\/09/i, subject: subject("legislacao-especifica", "Plano de carreiras estadual", "plano-de-carreiras-estadual"), reason: "Diploma estadual de carreiras citado no enunciado." },

  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /72 soldados|forma retangular/i, subject: subject("raciocinio-logico-quantitativo", "Aritmética e divisibilidade", "aritmetica-e-divisibilidade"), reason: "Problema de fatoração e divisibilidade." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /sorteia-se|probabilidade/i, subject: subject("raciocinio-logico-quantitativo", "Probabilidade", "probabilidade"), reason: "Experimento aleatório explícito." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /vetor|combina[cç][aã]o linear/i, subject: subject("raciocinio-logico-quantitativo", "Vetores", "vetores"), reason: "Vetores e combinação linear explícitos." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /para cada dois|para cada tr[eê]s/i, subject: subject("raciocinio-logico-quantitativo", "Razões e proporções", "razoes-e-proporcoes"), reason: "Relações proporcionais explícitas." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /conjuntos distintos|escolher.*homens.*mulheres/i, subject: subject("raciocinio-logico-quantitativo", "Análise combinatória", "analise-combinatoria"), reason: "Contagem de combinações." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /quadra.*ret[aâ]ngulo|[aá]rea da quadra/i, subject: subject("raciocinio-logico-quantitativo", "Geometria plana", "geometria-plana"), reason: "Cálculo de área em figura plana." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /cos\s*\(|sen\s*\(|tg\s*\(/i, subject: subject("raciocinio-logico-quantitativo", "Trigonometria", "trigonometria"), reason: "Razões trigonométricas fornecidas no enunciado." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /Se o oper[aá]rio|Maria n[aã]o ouve/i, subject: subject("raciocinio-logico-quantitativo", "Lógica proposicional", "logica-proposicional"), reason: "Encadeamento de proposições condicionais." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /Abelardo, Benito e Caetano/i, subject: subject("raciocinio-logico-quantitativo", "Lógica de associação", "logica-de-associacao"), reason: "Problema de associação de pessoas e atributos." },
  { disciplineSlug: "raciocinio-logico-quantitativo", pattern: /eixos cartesianos|carta n[aá]utica/i, subject: subject("raciocinio-logico-quantitativo", "Geometria analítica", "geometria-analitica"), reason: "Sistema de coordenadas cartesianas explícito." },

  { disciplineSlug: "nocoes-de-informatica", pattern: /Windows Explorer|lixeira|fun[cç][aã]o “Enviar para”/i, subject: subject("nocoes-de-informatica", "Sistemas operacionais", "sistemas-operacionais"), subsubject: subsubject("sistemas-operacionais", "Windows Explorer", "windows-explorer"), reason: "Operação explícita do Windows Explorer." },
  { disciplineSlug: "nocoes-de-informatica", pattern: /desfragmentar|Windows XP|Windows 7|Desktop vis[ií]vel/i, subject: subject("nocoes-de-informatica", "Sistemas operacionais", "sistemas-operacionais"), reason: "Operação explícita do sistema Windows." },
  { disciplineSlug: "nocoes-de-informatica", pattern: /CD[\s\S]*regrav[aá]vel/i, subject: subject("nocoes-de-informatica", "Hardware e mídias", "hardware-e-midias"), reason: "Mídia óptica explícita." },
  { disciplineSlug: "nocoes-de-informatica", pattern: /nota de rodap[eé]/i, subject: subject("nocoes-de-informatica", "Microsoft Word", "microsoft-word"), subsubject: subsubject("microsoft-word", "Notas de rodapé", "notas-de-rodape"), reason: "Recurso de nota de rodapé do Word." },
  { disciplineSlug: "nocoes-de-informatica", pattern: /h[uú]ngaro|idioma de revis[aã]o/i, subject: subject("nocoes-de-informatica", "Microsoft Word", "microsoft-word"), subsubject: subsubject("microsoft-word", "Revisão de texto", "revisao-de-texto"), reason: "Revisão ortográfica do Word explícita." },
  { disciplineSlug: "nocoes-de-informatica", pattern: /Quebra de Se[cç][aã]o|formato mostrado|sublinhar o texto/i, subject: subject("nocoes-de-informatica", "Microsoft Word", "microsoft-word"), subsubject: subsubject("microsoft-word", "Layout e seções", "layout-e-secoes"), reason: "Formatação e layout do Word explícitos." },
  { disciplineSlug: "nocoes-de-informatica", pattern: /Converter Texto em Tabela/i, subject: subject("nocoes-de-informatica", "Microsoft Word", "microsoft-word"), subsubject: subsubject("microsoft-word", "Tabelas", "tabelas"), reason: "Conversão em tabela do Word explícita." },

  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /organiza[cç][aã]o pol[ií]tico-administrativa/i, subject: subject("nocoes-de-direito-constitucional", "Organização do Estado", "organizacao-do-estado"), reason: "Tema constitucional citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /princ[ií]pios\s+da\s+Administra[cç][aã]o\s+P[uú]blica/i, subject: subject("nocoes-de-direito-constitucional", "Princípios da Administração Pública", "principios-da-administracao-publica"), reason: "Tema constitucional citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /Direitos Pol[ií]ticos/i, subject: subject("nocoes-de-direito-constitucional", "Direitos políticos", "direitos-politicos"), reason: "Tema constitucional citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /nacionalidade|brasileiros naturalizados/i, subject: subject("nocoes-de-direito-constitucional", "Nacionalidade", "nacionalidade"), reason: "Tema constitucional citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /inviolabilidade de domic[ií]lio/i, subject: subject("nocoes-de-direito-constitucional", "Direitos e garantias fundamentais", "direitos-e-garantias-fundamentais"), reason: "Garantia constitucional citada literalmente." },
  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /senadores|expedi[cç][aã]o do diploma/i, subject: subject("nocoes-de-direito-constitucional", "Poder Legislativo", "poder-legislativo"), reason: "Imunidades parlamentares explícitas." },
  { disciplineSlug: "nocoes-de-direito-constitucional", pattern: /Rem[eé]dios Constitucionais|Habeas Corpus/i, subject: subject("nocoes-de-direito-constitucional", "Remédios constitucionais", "remedios-constitucionais"), reason: "Remédios constitucionais citados literalmente." },

  { disciplineSlug: "nocoes-de-direito-administrativo", pattern: /organiza[cç][aã]o do Estado quanto [aà] Pol[ií]cia Civil/i, subject: subject("nocoes-de-direito-administrativo", "Organização administrativa e segurança pública", "organizacao-administrativa-e-seguranca-publica"), reason: "Organização da Polícia Civil explícita." },
  { disciplineSlug: "nocoes-de-direito-administrativo", pattern: /desapropria|desapropria[cç][aã]o/i, subject: subject("nocoes-de-direito-administrativo", "Intervenção do Estado na propriedade", "intervencao-do-estado-na-propriedade"), reason: "Desapropriação explícita." },
  { disciplineSlug: "nocoes-de-direito-administrativo", pattern: /servidor p[uú]blico|cargos p[uú]blicos|escrevente da pol[ií]cia/i, subject: subject("nocoes-de-direito-administrativo", "Agentes públicos", "agentes-publicos"), reason: "Regime de agentes e cargos públicos." },
  { disciplineSlug: "nocoes-de-direito-administrativo", pattern: /servi[cç]o p[uú]blico|tarifas diferenciadas/i, subject: subject("nocoes-de-direito-administrativo", "Serviços públicos", "servicos-publicos"), reason: "Prestação e tarifas de serviços públicos." },
  { disciplineSlug: "nocoes-de-direito-administrativo", pattern: /fiscais\s+da\s+Justi[cç]a\s+Eleitoral|opera[cç][aã]o\s+em\s+comunidade/i, subject: subject("nocoes-de-direito-administrativo", "Poder de polícia", "poder-de-policia"), reason: "Atuação fiscalizatória estatal." },
  { disciplineSlug: "nocoes-de-direito-administrativo", pattern: /Responsabilidade Civil do Estado/i, subject: subject("nocoes-de-direito-administrativo", "Responsabilidade civil do Estado", "responsabilidade-civil-do-estado"), reason: "Tema administrativo citado literalmente." },

  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /coca[ií]na|oferece aos policiais|advogado Juarez/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Crimes em espécie", "crimes-em-especie"), reason: "Caso concreto de tipificação penal." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /Sobre a pris[aã]o em flagrante|infra[cç][oõ]es permanentes/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Prisão em flagrante", "prisao-em-flagrante"), reason: "Instituto processual citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /den[uú]ncia ou queixa|a[cç][aã]o penal/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Ação penal", "acao-penal"), reason: "Instrumentos de ação penal citados." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /inqu[eé]rito\s+policial/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Inquérito policial", "inquerito-policial"), reason: "Instituto processual citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /meios? de prova|direito probat[oó]rio/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Provas no processo penal", "provas-no-processo-penal"), reason: "Direito probatório explícito." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /compet[eê]ncia[\s\S]*juiz\s+natural/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Competência processual penal", "competencia-processual-penal"), reason: "Competência processual explícita." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /Lei Maria da Penha/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Lei Maria da Penha", "lei-maria-da-penha"), reason: "Diploma legal citado literalmente." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /exclus[aã]o de ilicitude|leg[ií]tima defesa/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Exclusão de ilicitude", "exclusao-de-ilicitude"), reason: "Excludente de ilicitude explícita." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /extin[cç][aã]o da punibilidade|prescri[cç][aã]o/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Extinção da punibilidade", "extincao-da-punibilidade"), reason: "Prescrição penal explícita." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /conduta t[ií]pica|ordem comissiva|ordem omissiva/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Teoria do crime", "teoria-do-crime"), reason: "Estrutura da conduta típica explícita." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /aplica[cç][aã]o da lei penal|vacatio/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Aplicação da lei penal", "aplicacao-da-lei-penal"), reason: "Aplicação temporal da lei penal." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /concurso de pessoas|acessoriedade/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Concurso de pessoas", "concurso-de-pessoas"), reason: "Concurso de agentes explícito." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /animus necandi|se arrepende|desist/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Iter criminis", "iter-criminis"), reason: "Desistência, arrependimento e consumação." },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", pattern: /teoria da pena|pena base|circunst[aâ]ncias judiciais/i, subject: subject("nocoes-de-direito-penal-e-processual-penal", "Teoria da pena", "teoria-da-pena"), reason: "Dosimetria e teoria da pena explícitas." },
];

export interface RuleBasedQuestionClassifierOptions {
  discipline: QuestionClassification["discipline"];
}

export class RuleBasedQuestionClassifier {
  classify(question: ParsedQuestion, options: RuleBasedQuestionClassifierOptions): QuestionClassification {
    const rule = rules.find((candidate) => (
      candidate.disciplineSlug === options.discipline.slug
      && candidate.pattern.test(question.statement)
    ));

    if (!rule) {
      return {
        discipline: options.discipline,
        disciplineStatus: "CONFIRMED",
        disciplineConfidence: "OFFICIAL",
        subject: null,
        subjectStatus: "REVIEW_REQUIRED",
        subjectConfidence: "LOW",
        subsubject: null,
        subsubjectStatus: "UNCLASSIFIED",
        subsubjectConfidence: "LOW",
        overallStatus: "REVIEW_REQUIRED",
        overallConfidence: "LOW",
        reason: "Disciplina confirmada no gabarito oficial; assunto sem regra suficientemente específica.",
      };
    }

    const overallStatus = question.needsReview ? "REVIEW_REQUIRED" : "AUTO_CLASSIFIED";
    return {
      discipline: options.discipline,
      disciplineStatus: "CONFIRMED",
      disciplineConfidence: "OFFICIAL",
      subject: rule.subject,
      subjectStatus: "AUTO_CLASSIFIED",
      subjectConfidence: "HIGH",
      subsubject: rule.subsubject ?? null,
      subsubjectStatus: rule.subsubject ? "AUTO_CLASSIFIED" : "UNCLASSIFIED",
      subsubjectConfidence: rule.subsubject ? "HIGH" : "LOW",
      overallStatus,
      overallConfidence: question.needsReview ? "MEDIUM" : "HIGH",
      reason: rule.reason,
    };
  }
}
