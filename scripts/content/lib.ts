// Validação de todo o conteúdo de content/ e montagem do índice do catálogo (W0-03 §5.3, W2-04).
// buildContent é pura (os testes passam arquivos à mão); readContentDir lê o disco.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  CatalogIndex,
  Npc,
  PatternCatalog,
  VoiceEvalSet,
  World,
  fillPlayer,
  formatPath,
  matchReply,
  pairId,
  parseMission,
  type CatalogEntry,
  type Cefr,
  type Mission,
} from "../../src/schemas/index.ts";

/** Um arquivo de content/: caminho relativo a content/ com "/" e o JSON já lido (ou o erro de leitura). */
export interface ContentFile {
  readonly path: string;
  readonly json: unknown;
}

export interface ContentIssue {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

export interface BuildResult {
  readonly index: CatalogIndex;
  readonly issues: readonly ContentIssue[];
}

/** Teto de caracteres de uma fala da NPC por nível (W0-03 §5.4): frases curtas, um pouco acima do nível. */
export const LINE_MAX: Record<Cefr, number> = { A1: 80, A2: 120, B1: 160, B2: 220, C1: 220, C2: 220 };

const MISSION_PATH = /^missions\/([^/]+)\/([^/]+)\/([^/]+)\.json$/;

function zodIssues(file: string, error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }): ContentIssue[] {
  return error.issues.map((i) => ({ file, path: formatPath(i.path), message: i.message }));
}

/**
 * Falas que a NPC diz (ou que a escuta toca) no idioma-alvo, com o caminho de cada uma. São as que passam
 * pelo teto do nível e pelas regras de voz do navegador.
 */
function spokenLines(m: Mission): { path: string; text: string }[] {
  const lines: { path: string; text: string }[] = [];
  m.listen.forEach((l, i) => lines.push({ path: `listen[${i}].text`, text: l.text }));
  m.nodes.forEach((n, i) => {
    lines.push({ path: `nodes[${i}].text`, text: n.text });
    n.replies.forEach((r, j) => {
      if (r.reaction) lines.push({ path: `nodes[${i}].replies[${j}].reaction.text`, text: r.reaction.text });
    });
  });
  lines.push({ path: "closing.question.text", text: m.closing.question.text });
  lines.push({ path: "closing.success.text", text: m.closing.success.text });
  return lines;
}

/**
 * Bebidas alcoólicas, em inglês, português e espanhol (ajuste do Arquiteto na W2-03: o público inclui
 * adolescentes; nas missões só bebida sem álcool). Casamento por palavra inteira, sem acento.
 */
export const ALCOHOL = [
  "beer", "beers", "wine", "wines", "ale", "ales", "mead", "cider", "whisky", "whiskey", "vodka", "rum", "gin", "brandy", "liquor", "cocktail", "cocktails",
  "cerveja", "cervejas", "vinho", "vinhos", "cachaca", "hidromel", "caipirinha", "sidra",
  "cerveza", "cervezas", "vino", "vinos", "licor", "ron", "aguardiente",
];
const ALCOHOL_RE = new RegExp(`\\b(${ALCOHOL.join("|")})\\b`, "i");

/** Todos os textos de um JSON, com o caminho de cada um (para guardas que olham tudo). */
function allTexts(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => allTexts(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) allTexts(v, path ? `${path}.${k}` : k, out);
  }
}

/** Nenhuma bebida alcoólica em texto nenhum do arquivo (roda no JSON cru, antes de qualquer schema). */
export function alcoholIssues(file: string, json: unknown): ContentIssue[] {
  const texts: { path: string; text: string }[] = [];
  allTexts(json, "", texts);
  return texts.flatMap(({ path, text }) => {
    const hit = ALCOHOL_RE.exec(text.normalize("NFD").replace(/\p{M}/gu, ""));
    return hit ? [{ file, path, message: `bebida alcoólica ("${hit[1]}"): use suco, chá, leite ou chocolate quente` }] : [];
  });
}

/**
 * Regras de qualidade só das missões embutidas, além do schema:
 * - teto de caracteres da fala por nível;
 * - fala amigável à voz do navegador: sem dígito, símbolo ou emoji, e com pontuação no fim;
 * - a resposta-modelo também sem dígito (a pessoa repete em voz alta).
 * O vocativo ", {player}" (D-53) sai antes: a conferência 8 do parseMission já cuida dele, e a fala tem
 * de ficar boa também sem apelido.
 */
export function qualityIssues(file: string, m: Mission): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const max = LINE_MAX[m.level];
  const lines = spokenLines(m).map(({ path, text }) => ({ path, text: fillPlayer(text, null) }));
  for (const { path, text } of lines) {
    if (text.length > max) issues.push({ file, path, message: `fala com ${text.length} caracteres; o teto do ${m.level} é ${max}` });
  }
  for (const { path, text } of [...lines, { path: "closing.model_answer.text", text: m.closing.model_answer.text }]) {
    if (/\d/.test(text)) issues.push({ file, path, message: "escreva os números por extenso (a voz e o casamento ficam iguais)" });
    if (/[&/%*#@~<>[\]{}_|^$]|\p{Extended_Pictographic}/u.test(text)) issues.push({ file, path, message: "tire símbolos e emoji da fala" });
    if (!/[.!?]$/.test(text)) issues.push({ file, path, message: "termine a fala com . ! ou ?" });
  }
  return issues;
}

/** Valida tudo e monta o índice. `files` traz todo JSON de content/ (menos eval/ fora de eval/stt/). */
export function buildContent(files: readonly ContentFile[]): BuildResult {
  const issues: ContentIssue[] = files.flatMap((f) => alcoholIssues(f.path, f.json));
  const byPrefix = (prefix: string) => files.filter((f) => f.path.startsWith(prefix));

  // Vila.
  const worldFile = files.find((f) => f.path === "world/locations.json");
  const world = worldFile ? World.safeParse(worldFile.json) : null;
  if (!worldFile) issues.push({ file: "world/locations.json", path: "", message: "arquivo da vila não encontrado" });
  else if (world && !world.success) issues.push(...zodIssues(worldFile.path, world.error));
  const npcHome = new Map<string, string>();
  if (world?.success) for (const loc of world.data.locations) for (const npc of loc.npcs) npcHome.set(npc, loc.id);

  // NPCs.
  const npcs = new Map<string, Npc>();
  for (const f of byPrefix("npcs/")) {
    const parsed = Npc.safeParse(f.json);
    if (!parsed.success) {
      issues.push(...zodIssues(f.path, parsed.error));
      continue;
    }
    const npc = parsed.data;
    if (f.path !== `npcs/${npc.id}.json`) issues.push({ file: f.path, path: "id", message: `o arquivo tem de se chamar npcs/${npc.id}.json` });
    if (world?.success && npcHome.get(npc.id) !== npc.location) {
      issues.push({ file: f.path, path: "location", message: `a vila (world/locations.json) não põe ${npc.id} em ${npc.location}` });
    }
    npcs.set(npc.id, npc);
  }
  for (const id of npcHome.keys()) {
    if (!npcs.has(id)) issues.push({ file: "world/locations.json", path: "locations", message: `falta a ficha npcs/${id}.json` });
  }

  // Catálogos de erros, por par.
  const patterns = new Map<string, Set<string>>();
  for (const f of byPrefix("patterns/")) {
    const parsed = PatternCatalog.safeParse(f.json);
    if (!parsed.success) {
      issues.push(...zodIssues(f.path, parsed.error));
      continue;
    }
    const pair = pairId(parsed.data);
    if (f.path !== `patterns/${pair}.json`) issues.push({ file: f.path, path: "", message: `o arquivo tem de se chamar patterns/${pair}.json` });
    patterns.set(pair, new Set(parsed.data.patterns.map((p) => p.id)));
  }

  // Missões.
  const missions = new Map<string, Mission>();
  const entries: CatalogEntry[] = [];
  for (const f of byPrefix("missions/")) {
    const where = MISSION_PATH.exec(f.path);
    if (!where) {
      issues.push({ file: f.path, path: "", message: "use missions/<base>_<alvo>/<nível>/<id>.json" });
      continue;
    }
    const [, folderPair, folderLevel, fileId] = where;
    const catalog = patterns.get(folderPair!);
    if (!catalog) issues.push({ file: f.path, path: "", message: `falta o catálogo de erros patterns/${folderPair}.json` });
    const res = parseMission(f.json, { origin: "builtin", ...(catalog ? { patterns: catalog } : {}) });
    if (!res.ok) {
      issues.push(...res.issues.map((i) => ({ file: f.path, ...i })));
      continue;
    }
    const m = res.mission;
    const before = issues.length;
    if (pairId(m) !== folderPair) issues.push({ file: f.path, path: "base", message: `o par ${pairId(m)} não bate com a pasta ${folderPair}` });
    if (m.level !== folderLevel) issues.push({ file: f.path, path: "level", message: `o nível ${m.level} não bate com a pasta ${folderLevel}` });
    if (m.id !== fileId) issues.push({ file: f.path, path: "id", message: `o id ${m.id} não bate com o nome do arquivo` });
    if (missions.has(m.id)) issues.push({ file: f.path, path: "id", message: `missão repetida: ${m.id}` });
    m.characters.forEach((c, i) => {
      if (!c.npc) return;
      const npc = npcs.get(c.npc);
      if (!npc) issues.push({ file: f.path, path: `characters[${i}].npc`, message: `falta a ficha npcs/${c.npc}.json` });
      else if (!npc.lines[m.target]) issues.push({ file: f.path, path: `characters[${i}].npc`, message: `${c.npc} não tem falas fixas (lines.${m.target})` });
    });
    issues.push(...qualityIssues(f.path, m));
    if (issues.length > before) continue;
    missions.set(m.id, m);
    entries.push({ id: m.id, base: m.base, target: m.target, level: m.level, kind: m.kind, title: m.title, location: m.location, can_do: m.can_do, file: f.path });
  }

  // Frases do teste de voz (D-48): cada uma aponta para uma resposta que existe e casa com ela.
  for (const f of byPrefix("eval/stt/")) {
    const parsed = VoiceEvalSet.safeParse(f.json);
    if (!parsed.success) {
      issues.push(...zodIssues(f.path, parsed.error));
      continue;
    }
    const set = parsed.data;
    if (f.path !== `eval/stt/${pairId(set)}.json`) issues.push({ file: f.path, path: "", message: `o arquivo tem de se chamar eval/stt/${pairId(set)}.json` });
    set.phrases.forEach((p, i) => {
      const at = `phrases[${i}].expect`;
      const m = missions.get(p.expect.mission);
      if (!m) return issues.push({ file: f.path, path: at, message: `missão ${p.expect.mission} não existe (ou tem erro)` });
      if (pairId(m) !== pairId(set)) return issues.push({ file: f.path, path: at, message: `a missão ${m.id} é de outro par` });
      const node = m.nodes.find((n) => n.id === p.expect.node);
      if (!node) return issues.push({ file: f.path, path: at, message: `a fala ${p.expect.node} não existe em ${m.id}` });
      if (p.expect.reply >= node.replies.length) return issues.push({ file: f.path, path: at, message: `a fala ${node.id} só tem ${node.replies.length} respostas` });
      const hit = matchReply(node.replies, p.text, m.target);
      if (hit?.index !== p.expect.reply) {
        issues.push({ file: f.path, path: `phrases[${i}].text`, message: `"${p.text}" ${hit ? `casa com a resposta ${hit.index}` : "não casa"} no texto digitado; esperado ${p.expect.reply}` });
      }
      return undefined;
    });
  }

  const order = (e: CatalogEntry) => `${e.base}_${e.target}\u0000${e.level}\u0000${e.id}`;
  entries.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0));
  const index = CatalogIndex.parse({ schema: 1, missions: entries });
  return { index, issues };
}

/** Linhas legíveis para o terminal e para o CI. */
export function formatIssues(issues: readonly ContentIssue[]): string {
  return issues.map((i) => `content/${i.file}${i.path ? ` → ${i.path}` : ""}: ${i.message}`).join("\n");
}

/** Pastas de content/ que entram na validação (D-48: de eval/, só eval/stt/). */
export const SCANNED_DIRS = ["world", "npcs", "patterns", "missions", "eval/stt"] as const;

/** Lê todo JSON das pastas validadas. JSON quebrado vira problema, não exceção. */
export function readContentDir(contentDir: string): { files: ContentFile[]; issues: ContentIssue[] } {
  const files: ContentFile[] = [];
  const issues: ContentIssue[] = [];
  for (const dir of SCANNED_DIRS) {
    let names: string[];
    try {
      names = readdirSync(join(contentDir, dir), { recursive: true, encoding: "utf8" });
    } catch {
      continue;
    }
    for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
      const abs = join(contentDir, dir, name);
      const path = relative(contentDir, abs).split(sep).join("/");
      try {
        files.push({ path, json: JSON.parse(readFileSync(abs, "utf8")) as unknown });
      } catch (error) {
        issues.push({ file: path, path: "", message: `JSON inválido: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  }
  return { files, issues };
}
