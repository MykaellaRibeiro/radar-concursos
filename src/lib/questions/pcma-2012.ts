import type { DisciplineRange, SubjectSeed, SubsubjectSeed } from "./types";

export const PCMA_2012_PROOF_ID = "8d159a4e-c485-4cfb-8e4a-39ff79684150";
export const PCMA_2012_EXPECTED_QUESTIONS = 70;
export const PCMA_2012_ANSWER_KEY_TYPE = 1;

export const PCMA_2012_DISCIPLINE_RANGES: readonly DisciplineRange[] = [
  { start: 1, end: 15, discipline: { name: "Língua Portuguesa", slug: "lingua-portuguesa" } },
  { start: 16, end: 20, discipline: { name: "Legislação Específica", slug: "legislacao-especifica" } },
  { start: 21, end: 30, discipline: { name: "Raciocínio Lógico-quantitativo", slug: "raciocinio-logico-quantitativo" } },
  { start: 31, end: 40, discipline: { name: "Noções de Informática", slug: "nocoes-de-informatica" } },
  { start: 41, end: 47, discipline: { name: "Noções de Direito Constitucional", slug: "nocoes-de-direito-constitucional" } },
  { start: 48, end: 55, discipline: { name: "Noções de Direito Administrativo", slug: "nocoes-de-direito-administrativo" } },
  { start: 56, end: 70, discipline: { name: "Noções de Direito Penal e Processual Penal", slug: "nocoes-de-direito-penal-e-processual-penal" } },
] as const;

export const PCMA_2012_SUBJECTS: readonly SubjectSeed[] = [
  { disciplineSlug: "lingua-portuguesa", name: "Interpretação de textos", slug: "interpretacao-de-textos" },
  { disciplineSlug: "lingua-portuguesa", name: "Coesão textual", slug: "coesao-textual" },
  { disciplineSlug: "lingua-portuguesa", name: "Semântica", slug: "semantica" },
  { disciplineSlug: "lingua-portuguesa", name: "Reescrita de frases", slug: "reescrita-de-frases" },

  { disciplineSlug: "legislacao-especifica", name: "Estatuto dos servidores do Maranhão", slug: "estatuto-dos-servidores-do-maranhao" },
  { disciplineSlug: "legislacao-especifica", name: "Constituição do Estado do Maranhão", slug: "constituicao-do-estado-do-maranhao" },
  { disciplineSlug: "legislacao-especifica", name: "Plano de carreiras estadual", slug: "plano-de-carreiras-estadual" },

  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Aritmética e divisibilidade", slug: "aritmetica-e-divisibilidade" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Probabilidade", slug: "probabilidade" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Vetores", slug: "vetores" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Razões e proporções", slug: "razoes-e-proporcoes" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Análise combinatória", slug: "analise-combinatoria" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Geometria plana", slug: "geometria-plana" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Trigonometria", slug: "trigonometria" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Lógica proposicional", slug: "logica-proposicional" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Lógica de associação", slug: "logica-de-associacao" },
  { disciplineSlug: "raciocinio-logico-quantitativo", name: "Geometria analítica", slug: "geometria-analitica" },

  { disciplineSlug: "nocoes-de-informatica", name: "Sistemas operacionais", slug: "sistemas-operacionais" },
  { disciplineSlug: "nocoes-de-informatica", name: "Hardware e mídias", slug: "hardware-e-midias" },
  { disciplineSlug: "nocoes-de-informatica", name: "Microsoft Word", slug: "microsoft-word" },

  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Organização do Estado", slug: "organizacao-do-estado" },
  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Princípios da Administração Pública", slug: "principios-da-administracao-publica" },
  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Direitos políticos", slug: "direitos-politicos" },
  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Nacionalidade", slug: "nacionalidade" },
  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Direitos e garantias fundamentais", slug: "direitos-e-garantias-fundamentais" },
  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Poder Legislativo", slug: "poder-legislativo" },
  { disciplineSlug: "nocoes-de-direito-constitucional", name: "Remédios constitucionais", slug: "remedios-constitucionais" },

  { disciplineSlug: "nocoes-de-direito-administrativo", name: "Organização administrativa e segurança pública", slug: "organizacao-administrativa-e-seguranca-publica" },
  { disciplineSlug: "nocoes-de-direito-administrativo", name: "Intervenção do Estado na propriedade", slug: "intervencao-do-estado-na-propriedade" },
  { disciplineSlug: "nocoes-de-direito-administrativo", name: "Agentes públicos", slug: "agentes-publicos" },
  { disciplineSlug: "nocoes-de-direito-administrativo", name: "Serviços públicos", slug: "servicos-publicos" },
  { disciplineSlug: "nocoes-de-direito-administrativo", name: "Poder de polícia", slug: "poder-de-policia" },
  { disciplineSlug: "nocoes-de-direito-administrativo", name: "Responsabilidade civil do Estado", slug: "responsabilidade-civil-do-estado" },

  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Prisão em flagrante", slug: "prisao-em-flagrante" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Ação penal", slug: "acao-penal" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Inquérito policial", slug: "inquerito-policial" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Provas no processo penal", slug: "provas-no-processo-penal" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Competência processual penal", slug: "competencia-processual-penal" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Lei Maria da Penha", slug: "lei-maria-da-penha" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Exclusão de ilicitude", slug: "exclusao-de-ilicitude" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Extinção da punibilidade", slug: "extincao-da-punibilidade" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Teoria do crime", slug: "teoria-do-crime" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Aplicação da lei penal", slug: "aplicacao-da-lei-penal" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Concurso de pessoas", slug: "concurso-de-pessoas" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Crimes em espécie", slug: "crimes-em-especie" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Iter criminis", slug: "iter-criminis" },
  { disciplineSlug: "nocoes-de-direito-penal-e-processual-penal", name: "Teoria da pena", slug: "teoria-da-pena" },
] as const;

export const PCMA_2012_SUBSUBJECTS: readonly SubsubjectSeed[] = [
  { subjectSlug: "sistemas-operacionais", name: "Windows Explorer", slug: "windows-explorer" },
  { subjectSlug: "microsoft-word", name: "Revisão de texto", slug: "revisao-de-texto" },
  { subjectSlug: "microsoft-word", name: "Notas de rodapé", slug: "notas-de-rodape" },
  { subjectSlug: "microsoft-word", name: "Layout e seções", slug: "layout-e-secoes" },
  { subjectSlug: "microsoft-word", name: "Tabelas", slug: "tabelas" },
] as const;

export function pcmaDisciplineForQuestion(number: number) {
  return PCMA_2012_DISCIPLINE_RANGES.find((range) => number >= range.start && number <= range.end)?.discipline ?? null;
}
