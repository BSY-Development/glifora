// Conferências da missão além do Zod (W0-03 §5.1, com o fecho da D-43) e o parseMission, o caminho único
// de toda missão: embutida (catálogo e scripts), colada (fábrica, fase 4) e gerada pela IA (fase 6).
//
//   1. Ids de fala únicos; `next` existe e aponta para a frente (sem ciclo).
//   2. Todo caminho chega ao fim, e toda fala é alcançável. Com `next` só para a frente, todo caminho
//      termina; a conferência que sobra é a de fala que nenhum caminho alcança.
//   3. O texto de cada resposta casa com ela mesma no passe exato, sem empate com as irmãs.
//   4. Com `flawed`: `recast.original` está no texto da resposta e `recast.corrected` está em `reaction.text`.
//   5. `model_answer` contém uma das palavras-alvo (`closing.target_words` ou, se faltar, o vocabulário).
//   6. Todo `speaker` (escuta e falas) existe em `characters`.
//   7. Resposta livre (D-51): no máximo uma por fala, e nunca com `flawed`.
//   8. Apelido (D-53): `{player}` só nas falas das NPCs e nas traduções delas, sempre como ", {player}"
//      depois de algum texto, e no mesmo número no texto e na tradução. Em qualquer outro campo, não.
//
// Só na embutida: toda resposta tem `keywords`, A1–A2 tem escuta de pelo menos 2 falas e o id é slug.
// Com o catálogo de erros em mãos, `pattern` precisa existir nele.

import type { z } from "zod";
import { checkClosingAnswer, closingTargets, matchReply, normalize } from "./match";
import { Mission, type MissionInput } from "./mission";
import { countPlayerVocatives, fillPlayer, hasPlayerMarker, isPlayerMarkerWellFormed, PLAYER_VOCATIVE } from "./player";
import { Slug } from "./world";

export interface MissionIssue {
  /** Caminho no JSON, como "nodes[3].replies[1].text" ("" = a missão inteira). */
  readonly path: string;
  readonly message: string;
}

export type MissionOrigin = "builtin" | "generated";

export interface MissionCheckOptions {
  /** "builtin" (padrão): content/missions. "generated": fábrica ou IA, com regras mais leves. */
  readonly origin?: MissionOrigin;
  /** Ids do catálogo de erros do par; se vier, todo `pattern` precisa estar aqui. */
  readonly patterns?: ReadonlySet<string>;
}

export interface ParseMissionOptions extends MissionCheckOptions {
  /** Id que o app gerou ("local:<uuid>"). Substitui o id do JSON (o da IA é ignorado). */
  readonly id?: string;
}

export type ParseMissionResult =
  | { readonly ok: true; readonly mission: Mission }
  | { readonly ok: false; readonly issues: readonly MissionIssue[] };

/** "nodes[3].text" a partir de ["nodes", 3, "text"]. */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    const name = String(key);
    return acc ? `${acc}.${name}` : name;
  }, "");
}

function zodIssues(error: z.ZodError): MissionIssue[] {
  return error.issues.map((i) => ({ path: formatPath(i.path), message: i.message }));
}

function containsWords(haystack: string, needle: string, lang: Mission["target"]): boolean {
  const n = normalize(needle, lang);
  return n.length > 0 && ` ${normalize(haystack, lang)} `.includes(` ${n} `);
}

/** Apelido de exemplo para conferir a fala com o nome no lugar do marcador. */
const SAMPLE_NICKNAME = "Sam";

/** Os campos onde `{player}` pode aparecer (D-53): as falas das NPCs e as traduções delas. */
const PLAYER_ALLOWED = [
  /^nodes\[\d+\]\.(text|translation)$/,
  /^nodes\[\d+\]\.replies\[\d+\]\.reaction\.(text|translation)$/,
  /^closing\.(question|success)\.(text|translation)$/,
];

/** Todo texto da missão, com o caminho no JSON. */
function stringLeaves(value: unknown, path: PropertyKey[] = [], out: [PropertyKey[], string][] = []): [PropertyKey[], string][] {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => stringLeaves(v, [...path, i], out));
  else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) stringLeaves(v, [...path, k], out);
  }
  return out;
}

/** As conferências 1–8 (e as da origem) sobre uma missão que já passou no Zod. Lista vazia = tudo certo. */
export function checkMission(m: Mission, options: MissionCheckOptions = {}): MissionIssue[] {
  const origin = options.origin ?? "builtin";
  const issues: MissionIssue[] = [];
  const add = (path: readonly PropertyKey[], message: string) => issues.push({ path: formatPath(path), message });
  const lang = m.target;

  // 1. Ids únicos e `next` para a frente.
  const indexOf = new Map<string, number>();
  m.nodes.forEach((node, i) => {
    if (indexOf.has(node.id)) add(["nodes", i, "id"], `fala repetida: ${node.id}`);
    else indexOf.set(node.id, i);
  });
  let graphOk = true;
  m.nodes.forEach((node, i) =>
    node.replies.forEach((r, j) => {
      if (r.next === undefined) return;
      const target = indexOf.get(r.next);
      if (target === undefined) {
        add(["nodes", i, "replies", j, "next"], `next "${r.next}" não existe`);
        graphOk = false;
      } else if (target <= i) {
        add(["nodes", i, "replies", j, "next"], `next "${r.next}" tem de apontar para uma fala posterior (sem voltar nem repetir)`);
        graphOk = false;
      }
    }),
  );

  // 2. Toda fala é alcançável a partir da primeira (todo caminho termina, porque só anda para a frente).
  if (graphOk) {
    const reached = new Set<number>([0]);
    for (let i = 0; i < m.nodes.length; i++) {
      if (!reached.has(i)) continue;
      for (const r of m.nodes[i]!.replies) {
        const to = r.next === undefined ? i + 1 : indexOf.get(r.next)!;
        if (to < m.nodes.length) reached.add(to);
      }
    }
    m.nodes.forEach((node, i) => {
      if (!reached.has(i)) add(["nodes", i], `a fala "${node.id}" não é alcançada por nenhum caminho`);
    });
  }

  // 3. Cada resposta casa com o próprio texto, no passe exato e sem empate.
  m.nodes.forEach((node, i) =>
    node.replies.forEach((r, j) => {
      const hit = matchReply(node.replies, r.text, lang);
      if (!hit || hit.index !== j || hit.pass !== "exact") {
        const why = !hit ? "não casa com nada (ou empata com outra)" : hit.index !== j ? `casa com a resposta ${hit.index}` : "só casa no passe tolerante";
        add(["nodes", i, "replies", j, "keywords"], `o texto "${r.text}" ${why}: ajuste as keywords`);
      }
    }),
  );

  // 4. Recast coerente com a resposta e com a reação.
  m.nodes.forEach((node, i) =>
    node.replies.forEach((r, j) => {
      if (!r.flawed || !r.recast || !r.reaction) return;
      if (!containsWords(r.text, r.recast.original, lang)) {
        add(["nodes", i, "replies", j, "recast", "original"], `"${r.recast.original}" não está no texto da resposta`);
      }
      // Com e sem apelido (D-53): o vocativo não pode cair no meio da forma certa.
      const reaction = r.reaction.text;
      if (![null, SAMPLE_NICKNAME].every((nick) => containsWords(fillPlayer(reaction, nick), r.recast!.corrected, lang))) {
        add(["nodes", i, "replies", j, "recast", "corrected"], `"${r.recast.corrected}" não está na reação da NPC`);
      }
    }),
  );

  // 5. A resposta-modelo do fecho contém uma das palavras-alvo.
  const targets = closingTargets(m);
  if (targets.length === 0) {
    add(["closing", "target_words"], "o fecho precisa de target_words (ou de vocabulary)");
  } else if (!checkClosingAnswer(targets, m.closing.model_answer.text, lang).accepted) {
    add(["closing", "model_answer", "text"], "a resposta-modelo não tem nenhuma das palavras-alvo");
  }

  // 6. Quem fala existe em `characters`.
  const speakers = new Set(m.characters.map((c) => c.id));
  m.listen.forEach((l, i) => {
    if (!speakers.has(l.speaker)) add(["listen", i, "speaker"], `"${l.speaker}" não está em characters`);
  });
  m.nodes.forEach((node, i) => {
    if (!speakers.has(node.speaker)) add(["nodes", i, "speaker"], `"${node.speaker}" não está em characters`);
  });

  // 7. Resposta livre.
  m.nodes.forEach((node, i) => {
    let seen = false;
    node.replies.forEach((r, j) => {
      if (!r.free) return;
      if (r.flawed) add(["nodes", i, "replies", j, "free"], "resposta livre (free) não pode ter erro previsto (flawed)");
      if (seen) add(["nodes", i, "replies", j, "free"], "no máximo uma resposta livre (free) por fala");
      seen = true;
    });
  });

  // 8. Apelido (D-53).
  for (const [path, value] of stringLeaves(m)) {
    const where = formatPath(path);
    if (PLAYER_ALLOWED.some((re) => re.test(where))) {
      if (!isPlayerMarkerWellFormed(value)) {
        add(path, `o apelido entra só como "${PLAYER_VOCATIVE}" (vírgula, espaço, {player}); sobrou chave fora dessa forma`);
      } else if (countPlayerVocatives(value) > 0 && (value.indexOf(PLAYER_VOCATIVE) === 0 || fillPlayer(value, null).trim() === "")) {
        add(path, `"${PLAYER_VOCATIVE}" precisa vir depois de algum texto (ex.: "Good morning, {player}!")`);
      }
    } else if (hasPlayerMarker(value)) {
      add(path, "{player} só pode aparecer nas falas das NPCs (nodes[].text, reaction.text, closing.question, closing.success) e nas traduções delas");
    }
  }
  const samePlayerCount = (line: { text: string; translation: string }, path: PropertyKey[]) => {
    const a = countPlayerVocatives(line.text);
    const b = countPlayerVocatives(line.translation);
    if (a !== b) add([...path, "translation"], `o texto tem ${a} "${PLAYER_VOCATIVE}" e a tradução tem ${b}: use o mesmo número nos dois`);
  };
  m.nodes.forEach((node, i) => {
    samePlayerCount(node, ["nodes", i]);
    node.replies.forEach((r, j) => r.reaction && samePlayerCount(r.reaction, ["nodes", i, "replies", j, "reaction"]));
  });
  samePlayerCount(m.closing.question, ["closing", "question"]);
  samePlayerCount(m.closing.success, ["closing", "success"]);

  // Catálogo de erros.
  if (options.patterns) {
    m.nodes.forEach((node, i) =>
      node.replies.forEach((r, j) => {
        if (r.pattern && !options.patterns!.has(r.pattern)) add(["nodes", i, "replies", j, "pattern"], `padrão "${r.pattern}" não está no catálogo`);
      }),
    );
  }

  // Só na embutida.
  if (origin === "builtin") {
    if (!Slug.safeParse(m.id).success) add(["id"], "missão embutida usa id em slug (ex.: bakery-01)");
    if ((m.level === "A1" || m.level === "A2") && m.listen.length < 2) {
      add(["listen"], "missão embutida de A1–A2 precisa de pelo menos 2 falas de escuta (princípio 1)");
    }
    m.nodes.forEach((node, i) =>
      node.replies.forEach((r, j) => {
        if (!r.keywords) add(["nodes", i, "replies", j, "keywords"], "missão embutida precisa de keywords em toda resposta");
      }),
    );
  }

  return issues;
}

/**
 * O único caminho de entrada de uma missão: Zod estrito + conferências. Nunca lança; devolve a missão
 * pronta ou a lista de problemas com o caminho de cada um (a fábrica mostra num bloco copiável).
 */
export function parseMission(input: unknown, options: ParseMissionOptions = {}): ParseMissionResult {
  const raw =
    options.id !== undefined && typeof input === "object" && input !== null && !Array.isArray(input)
      ? ({ ...(input as Record<string, unknown>), id: options.id } satisfies Partial<Record<keyof MissionInput, unknown>>)
      : input;
  const parsed = Mission.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const issues = checkMission(parsed.data, options);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, mission: parsed.data };
}
