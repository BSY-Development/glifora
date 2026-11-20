// Casamento da fala ou do texto da pessoa com as respostas da missão (modo demo, sem IA). D-43.
// Funções puras, só TypeScript: o player, o catálogo, a fábrica e os scripts usam as mesmas.
// Origem: match.ts do arquivo comercial (D-38), adaptado à D-43. A tabela de testes está em match.test.ts.
//
// Regra:
//   1. normalize(texto, idioma), dos dois lados (pessoa e palavras-chave): minúsculas, sem acento,
//      apóstrofos tipográficos viram "'", contrações expandidas (com e sem apóstrofo), "'s" só depois
//      de pronome ou palavra interrogativa, sem pontuação, números de 0 a 99 por extenso.
//   2. Uma alternativa de `keywords` casa quando todas as suas palavras ou expressões aparecem como
//      palavras inteiras (expressão de várias palavras: junta e nessa ordem). Pontos = número de
//      palavras da maior alternativa que casou.
//   3. Sem `keywords` (fábrica): casa quando a fala tem pelo menos 60% das palavras de conteúdo do
//      texto da resposta. Pontos = palavras de conteúdo encontradas.
//   4. Passe exato com todas as respostas. Só se nada casar, passe tolerante só com as respostas boas:
//      palavra de 4 a 7 letras a 1 letra de distância, de 8 ou mais a 2; até 3 letras, exata.
//      A resposta com erro (`flawed`) nunca casa no passe tolerante ("roll" × "rolls").
//   5. Vence quem tem mais pontos. Empate entre boa e com erro → a boa. Empate entre boas (ou entre
//      respostas com erro) ou nada → null: a NPC pede para repetir.
//   6. Voz: as alternativas do reconhecedor são testadas em ordem; fica a primeira que casar.
//   7. Resposta livre (`free: "name"`, D-51): só quando nenhuma resposta casa (nem boa, nem com erro, nem
//      empate) em nenhuma alternativa, a resposta livre aceita fala de 1 a 3 palavras normalizadas, desde
//      que nenhuma delas mostre que a pessoa não entendeu ("sorry", "what", "repeat"...).
//
// "1 letra de distância" conta inserção, remoção, troca ou inversão de duas letras vizinhas
// (distância de Damerau-Levenshtein restrita): "rols", "rollls", "rplls" e "rlols" ficam a 1 de "rolls".

import type { ContentLang } from "./lang";

// ---------------------------------------------------------------- normalização

/** Pronomes e palavras interrogativas que aceitam "'s", "'re", "'ll", "'d", "'ve", "'m" contraídos. */
const EN_CONTRACTION_HOSTS = new Set([
  "i", "you", "he", "she", "it", "we", "they", "that", "this", "there", "here",
  "what", "where", "who", "how", "when", "why", "which",
]);
// As tabelas buscadas com texto da pessoa são Map, nunca objeto comum: "constructor", "__proto__" ou
// "toString" num objeto devolvem o que vem do Object.prototype (F-W2-13-01).
const table = (entries: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(entries));

const EN_SUFFIX = table({ s: "is", re: "are", ll: "will", d: "would", ve: "have", m: "am" });
/** "n't" com forma própria; o resto é só "<verbo> not". */
const EN_NOT_SPECIAL = table({ ca: "can", wo: "will", sha: "shall" });

/**
 * Contrações escritas sem apóstrofo que não se confundem com outra palavra.
 * Ficam de fora as ambíguas: "were" (we're), "ill" (I'll), "well" (we'll), "hell", "shell", "shed",
 * "wed", "lets" (let's). O possessivo "its" vira "it is", como manda a D-43 ("'s" depois de pronome).
 */
const EN_BARE = table({
  im: "i am", youre: "you are", theyre: "they are",
  ive: "i have", youve: "you have", weve: "we have", theyve: "they have",
  id: "i would", youd: "you would", hed: "he would", theyd: "they would",
  youll: "you will", theyll: "they will", itll: "it will",
  its: "it is", hes: "he is", shes: "she is", thats: "that is", whats: "what is", wheres: "where is",
  whos: "who is", hows: "how is", theres: "there is", heres: "here is",
  dont: "do not", doesnt: "does not", didnt: "did not", isnt: "is not", arent: "are not",
  wasnt: "was not", werent: "were not", havent: "have not", hasnt: "has not", hadnt: "had not",
  wont: "will not", wouldnt: "would not", shouldnt: "should not", couldnt: "could not",
  cant: "can not", cannot: "can not", mustnt: "must not",
});

function expandEnglish(token: string): string {
  const apos = token.indexOf("'");
  if (apos < 0) return EN_BARE.get(token) ?? token;
  if (token === "can't") return "can not";
  if (token.endsWith("n't")) {
    const verb = token.slice(0, -3);
    if (!verb.includes("'")) return `${EN_NOT_SPECIAL.get(verb) ?? verb} not`;
  }
  const host = token.slice(0, apos);
  const suffix = token.slice(apos + 1);
  const full = EN_SUFFIX.get(suffix);
  if (full && EN_CONTRACTION_HOSTS.has(host)) return `${host} ${full}`;
  // Possessivo ("tilda's") e qualquer outro apóstrofo: o apóstrofo some.
  return token.replaceAll("'", "");
}

// Números por extenso. Tudo sem acento, porque a normalização tira os acentos antes.
const EN_UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ES_UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidos", "veintitres", "veinticuatro", "veinticinco", "veintiseis",
  "veintisiete", "veintiocho", "veintinueve"];
const ES_TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const PT_UNITS = ["zero", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const PT_TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];

function numberWords(n: number, lang: ContentLang): string {
  switch (lang) {
    case "en":
      return n < 20 ? EN_UNITS[n]! : n % 10 === 0 ? EN_TENS[n / 10]! : `${EN_TENS[Math.floor(n / 10)]} ${EN_UNITS[n % 10]}`;
    case "es":
      return n < 30 ? ES_UNITS[n]! : n % 10 === 0 ? ES_TENS[n / 10]! : `${ES_TENS[Math.floor(n / 10)]} y ${ES_UNITS[n % 10]}`;
    case "pt-BR":
      return n < 20 ? PT_UNITS[n]! : n % 10 === 0 ? PT_TENS[n / 10]! : `${PT_TENS[Math.floor(n / 10)]} e ${PT_UNITS[n % 10]}`;
  }
}

/** Formas do mesmo número que viram uma só (gênero e grafia): "duas" = "dois" = "2". */
const NUMBER_FOLD: Record<ContentLang, ReadonlyMap<string, string>> = {
  en: table({}),
  es: table({ un: "uno", una: "uno", veintiun: "veintiuno", veintiuna: "veintiuno" }),
  "pt-BR": table({ uma: "um", duas: "dois", quatorze: "catorze" }),
};

const TYPOGRAPHIC_APOSTROPHES = /[’‘´`ʼ′]/g;

/**
 * Forma comparável de um texto no idioma dado. Usada dos dois lados: na fala ou no texto da pessoa e
 * nas palavras-chave. Devolve as palavras separadas por um espaço ("" se não sobrar nada).
 */
export function normalize(text: string, lang: ContentLang): string {
  const tokens = text
    .replace(TYPOGRAPHIC_APOSTROPHES, "'")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
  const out: string[] = [];
  const fold = NUMBER_FOLD[lang];
  for (const token of tokens) {
    const expanded = lang === "en" ? expandEnglish(token) : token.replaceAll("'", "");
    for (const word of expanded.split(" ")) {
      if (!word) continue;
      if (/^\d+$/.test(word) && Number(word) <= 99) out.push(...numberWords(Number(word), lang).split(" "));
      else out.push(fold.get(word) ?? word);
    }
  }
  return out.join(" ");
}

/**
 * Até quantos caracteres da fala o casamento olha. Uma resposta tem até 300; o resto de um texto colado
 * enorme só custaria tempo no passe tolerante.
 */
export const MAX_UTTERANCE = 500;

function words(text: string, lang: ContentLang): string[] {
  const n = normalize(text.slice(0, MAX_UTTERANCE), lang);
  return n ? n.split(" ") : [];
}

// ---------------------------------------------------------------- palavras de conteúdo

const STOPWORDS: Record<ContentLang, ReadonlySet<string>> = {
  en: new Set(("a an the i you he she it we they me him her us them my your his its our their this that these those " +
    "is am are was were be been being do does did have has had will would can could shall should may might must " +
    "to of in on at for with from by and or but so not please oh uh um well just very").split(" ")),
  es: new Set(("el la los las un uno una unos unas yo tu el ella nosotros ellos me te se lo le nos mi su sus este esta eso " +
    "es son soy eres esta estoy estan ser estar hay de del a al en con por para y o pero que no si por favor muy " +
    "pues bueno eh").split(" ")),
  "pt-BR": new Set(("o a os as um uma uns umas eu voce ele ela nos eles elas me te se lhe meu minha seu sua este esta isso " +
    "e sou esta estou sao ser estar tem de do da dos das em no na nos nas com por para pelo pela ou mas que nao " +
    "por favor muito tipo ne ah eh").split(" ")),
};

/** Palavras de conteúdo (sem artigo, pronome, auxiliar, preposição) de um texto, sem repetir. */
export function contentWords(text: string, lang: ContentLang): string[] {
  const all = words(text, lang);
  const content = [...new Set(all.filter((w) => !STOPWORDS[lang].has(w)))];
  return content.length > 0 ? content : [...new Set(all)];
}

// ---------------------------------------------------------------- distância e casamento

/** Quantas letras de diferença a palavra esperada aceita no passe tolerante (D-43). */
function tolerance(expected: string): number {
  if (expected.length <= 3) return 0;
  return expected.length <= 7 ? 1 : 2;
}

/** Distância de Damerau-Levenshtein restrita, parando cedo quando passa de `max`. */
function withinDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (max === 0 || Math.abs(a.length - b.length) > max) return false;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2]! + 1);
      cur.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

function wordMatches(expected: string, said: string, fuzzy: boolean): boolean {
  return fuzzy ? withinDistance(expected, said, tolerance(expected)) : expected === said;
}

/** A expressão (já normalizada, em palavras) aparece inteira e na ordem na fala? */
function containsPhrase(said: readonly string[], phrase: readonly string[], fuzzy: boolean): boolean {
  if (phrase.length === 0) return false;
  for (let i = 0; i + phrase.length <= said.length; i++) {
    if (phrase.every((w, j) => wordMatches(w, said[i + j]!, fuzzy))) return true;
  }
  return false;
}

/** O mínimo que o casamento precisa de uma resposta. `Reply` da missão cabe aqui. */
export interface MatchableReply {
  readonly text: string;
  readonly keywords?: readonly (readonly string[])[] | undefined;
  readonly flawed?: boolean | undefined;
  /** Resposta livre (D-51): aceita fala curta quando nada mais casa. */
  readonly free?: "name" | undefined;
}

/** Passe de comparação de palavras. */
export type ScorePass = "exact" | "fuzzy";
/** Como a resposta casou: passe exato, tolerante ou pela resposta livre (D-51). */
export type MatchPass = ScorePass | "free";

/** Até quantas palavras (normalizadas) a resposta livre aceita. */
export const FREE_MAX_WORDS = 3;

/**
 * Palavras que mostram que a fala curta não é um nome: quem não entendeu a pergunta diz "Sorry?",
 * "What?", "Repeat, please". Com qualquer uma delas, a resposta livre não aceita e a NPC pede para repetir.
 * Já normalizadas (sem acento; contrações expandidas). Ficam de fora palavras que também são nomes
 * comuns (Will, Grace, Hope, Joy, May).
 */
const NOT_A_NAME: Record<ContentLang, ReadonlySet<string>> = {
  en: new Set(("yes yeah yep no nope not sorry what pardon excuse repeat again help hello hi hey thanks thank please " +
    "um uh huh hm hmm ok okay maybe know understand the a an").split(" ")),
  es: new Set(("si no perdon perdona disculpa que como repite repetir otra vez ayuda hola gracias por favor " +
    "eh hm vale quizas se entiendo el la un una").split(" ")),
  "pt-BR": new Set(("sim nao desculpa desculpe perdao que como repete repetir de novo ajuda oi ola obrigado obrigada " +
    "por favor hum ahn ne ta talvez sei entendi o a um uma").split(" ")),
};

/** A fala (já normalizada) pode ser um nome para a resposta livre? 1 a 3 palavras e nenhuma da lista acima. */
export function couldBeName(said: readonly string[], lang: ContentLang): boolean {
  return said.length >= 1 && said.length <= FREE_MAX_WORDS && !said.some((w) => NOT_A_NAME[lang].has(w));
}

export interface ReplyMatch<R extends MatchableReply> {
  /** Posição da resposta em `replies`. */
  readonly index: number;
  readonly reply: R;
  /** Em que passe casou. */
  readonly pass: MatchPass;
  /** Qual alternativa do reconhecedor casou (0 no texto digitado). */
  readonly alternative: number;
}

/** Fração mínima das palavras de conteúdo para casar uma resposta sem `keywords`. */
export const CONTENT_WORDS_MIN = 0.6;

/** Pontos da resposta para a fala já em palavras normalizadas (0 = não casou). */
export function scoreReply(reply: MatchableReply, said: readonly string[], lang: ContentLang, pass: ScorePass): number {
  const fuzzy = pass === "fuzzy";
  if (reply.keywords && reply.keywords.length > 0) {
    let best = 0;
    for (const alt of reply.keywords) {
      const phrases = alt.map((kw) => words(kw, lang));
      if (phrases.length === 0 || !phrases.every((p) => containsPhrase(said, p, fuzzy))) continue;
      best = Math.max(best, phrases.reduce((n, p) => n + p.length, 0));
    }
    return best;
  }
  const content = contentWords(reply.text, lang);
  if (content.length === 0) return 0;
  const found = content.filter((w) => said.some((s) => wordMatches(w, s, fuzzy))).length;
  return found / content.length >= CONTENT_WORDS_MIN ? found : 0;
}

function pick<R extends MatchableReply>(replies: readonly R[], said: readonly string[], lang: ContentLang, pass: ScorePass): { index: number } | null | "none" {
  const scores = replies.map((r, i) => (pass === "fuzzy" && r.flawed ? 0 : scoreReply(replies[i]!, said, lang, pass)));
  const top = Math.max(0, ...scores);
  if (top === 0) return "none";
  const best = scores.flatMap((s, i) => (s === top ? [i] : []));
  if (best.length === 1) return { index: best[0]! };
  const good = best.filter((i) => !replies[i]!.flawed);
  // Na dúvida, vale a resposta boa; empate entre boas (ou só entre respostas com erro) → null.
  return good.length === 1 ? { index: good[0]! } : null;
}

/** Casamento normal de uma fala: a resposta, null (empate) ou "none" (nada casou). */
function matchOne<R extends MatchableReply>(replies: readonly R[], said: readonly string[], lang: ContentLang): { index: number; pass: ScorePass } | null | "none" {
  if (said.length === 0) return "none";
  const exact = pick(replies, said, lang, "exact");
  if (exact !== "none") return exact && { index: exact.index, pass: "exact" };
  const fuzzy = pick(replies, said, lang, "fuzzy");
  if (fuzzy === "none") return "none";
  return fuzzy && { index: fuzzy.index, pass: "fuzzy" };
}

/**
 * Qual resposta a pessoa deu, ou null (não casou ou ficou ambíguo: a NPC pede para repetir).
 * `utterance` é o texto digitado ou as alternativas do reconhecedor de voz, da mais provável para a menos.
 */
export function matchReply<R extends MatchableReply>(
  replies: readonly R[],
  utterance: string | readonly string[],
  lang: ContentLang,
): ReplyMatch<R> | null {
  const alternatives = (typeof utterance === "string" ? [utterance] : utterance).map((u) => words(u, lang));
  const results = alternatives.map((said) => matchOne(replies, said, lang));
  for (let a = 0; a < results.length; a++) {
    const m = results[a];
    if (m && m !== "none") return { index: m.index, reply: replies[m.index]!, pass: m.pass, alternative: a };
  }
  // D-51: a resposta livre só entra se nenhuma alternativa casou nem empatou.
  const free = replies.findIndex((r) => r.free && !r.flawed);
  if (free < 0 || results.some((m) => m !== "none")) return null;
  const a = alternatives.findIndex((said) => couldBeName(said, lang));
  return a < 0 ? null : { index: free, reply: replies[free]!, pass: "free", alternative: a };
}

// ---------------------------------------------------------------- fecho (D-43, garantia 2)

export interface ClosingCheck {
  readonly accepted: boolean;
  /** A palavra-alvo encontrada, como está na lista; null se nenhuma. */
  readonly matched: string | null;
  readonly pass: ScorePass | null;
  /** Qual alternativa do reconhecedor foi aceita (0 no texto digitado); null se nenhuma. */
  readonly alternative: number | null;
}

/**
 * A frase própria do fecho é aceita se tiver pelo menos uma das palavras-alvo, com a mesma
 * normalização e a mesma tolerância. Nada além disso: sem mínimo de palavras e sem gramática.
 */
export function checkClosingAnswer(targets: readonly string[], utterance: string | readonly string[], lang: ContentLang): ClosingCheck {
  const alternatives = typeof utterance === "string" ? [utterance] : utterance;
  const phrases = targets.map((t) => ({ target: t, words: words(t, lang) }));
  for (const pass of ["exact", "fuzzy"] as const) {
    for (let a = 0; a < alternatives.length; a++) {
      const said = words(alternatives[a]!, lang);
      const hit = phrases.find((p) => containsPhrase(said, p.words, pass === "fuzzy"));
      if (hit) return { accepted: true, matched: hit.target, pass, alternative: a };
    }
  }
  return { accepted: false, matched: null, pass: null, alternative: null };
}

/** As palavras-alvo do fecho: `closing.target_words` ou, se faltar, as palavras de conteúdo do vocabulário. */
export function closingTargets(
  mission: { readonly target: ContentLang; readonly closing: { readonly target_words?: readonly string[] | undefined }; readonly vocabulary: readonly { readonly term: string }[] },
): string[] {
  const own = mission.closing.target_words;
  if (own && own.length > 0) return [...own];
  return [...new Set(mission.vocabulary.flatMap((v) => contentWords(v.term, mission.target)))];
}
