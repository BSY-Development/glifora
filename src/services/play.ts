// Jogar uma missão (W2-08) e o relatório (W2-09): junta catálogo, motor, voz e dados. Sem React.
// A rodada em andamento vai para `session` a cada passo (retomável). Ao concluir, grava `runs` e `events` (ids
// determinísticos: gravar duas vezes vale uma só) e só então limpa a sessão, então uma queda no meio refaz sem pagar em dobro.
import { list as listCatalog, load as loadCatalog, loadNpc, loadPatterns, type CatalogEntry } from "../catalog";
import { appendEvent, appendRun, clearSession, listEvents, listRuns, loadSession, localDay, saveSession, type Run } from "../data";
import {
  answersOf,
  deriveProgress,
  effectiveMode,
  masteryOf,
  parseState,
  paysFullToday,
  planRun,
  replyXp,
  rulesV1,
  start,
  suggestedMode,
  todayLevels,
  type Mode,
  type PlayState,
  type Progress,
  type Step,
  type TodayLevels,
} from "../engine";
import { getLocale } from "../i18n";
import { fillPlayer, type ContentLang, type Mission, type Npc, type Pattern, type VocabItem } from "../schemas";
import { loadPrefs, loadProfile } from "./player";
import { getDb, getDeps } from "./storage";
import { tts } from "./voice";

export type { Mode, PlayState, Step } from "../engine";

/** O idioma que se aprende. Só inglês por enquanto (D-40). */
export const TARGET_LANG: ContentLang = "en";

/** O idioma das traduções: o escolhido no perfil, senão o da interface. */
export async function baseLang(): Promise<ContentLang> {
  const prefs = await loadPrefs();
  return prefs.baseLang ?? getLocale();
}

// ---------- Lista de missões de um local ----------

export interface MissionCard {
  entry: CatalogEntry;
  /** Estrelas conquistadas (0 a 3). */
  stars: number;
  /** Ainda paga cheio hoje (sem rodada hoje): vira a marca "XP cheio hoje". */
  fullToday: boolean;
  suggested: Mode;
}

export async function listPlace(location: string): Promise<MissionCard[]> {
  const base = await baseLang();
  if (base === TARGET_LANG) return []; // par precisa de idiomas diferentes
  const entries = (await listCatalog({ base, target: TARGET_LANG })).filter((e) => e.location === location);
  const db = getDb();
  const runs = await listRuns(db);
  const today = localDay(getDeps().now());
  return entries.map((entry) => {
    const stars = masteryOf(runs.filter((r) => r.missionId === entry.id));
    return { entry, stars, fullToday: paysFullToday(runs, entry.id, today), suggested: suggestedMode(stars, entry.kind) };
  });
}

// ---------- Preparar a rodada ----------

export interface Voice {
  lang: string;
  rate: number;
  pitch: number;
}

/** Voz de quem não tem ficha de NPC (o freguês da escuta): mais grave que a da NPC, para a pessoa distinguir. */
const FALLBACK_VOICE: Record<ContentLang, Voice> = {
  en: { lang: "en-US", rate: 0.95, pitch: 0.8 },
  es: { lang: "es-ES", rate: 0.95, pitch: 0.8 },
  "pt-BR": { lang: "pt-BR", rate: 0.95, pitch: 0.8 },
};

export interface Prepared {
  mission: Mission;
  /** Voz de cada personagem da missão (`Character.id`). */
  voices: Record<string, Voice>;
  /** A NPC de cada personagem que tem ficha (`Character.id`). */
  npcs: Record<string, Npc>;
  stars: number;
  suggested: Mode;
  today: TodayLevels;
  /** Rodada em andamento desta missão, se houver e der para retomar. */
  resume: PlayState | null;
  /** O dia local de agora. */
  day: string;
}

export type PrepareResult = { ok: true; prepared: Prepared } | { ok: false; reason: "unknown" | "missing" | "invalid" };

/**
 * D-53: troca `{player}` pelo apelido nas falas das NPCs (texto e tradução), num lugar só. Quem lê a missão depois
 * (balões, destaque do recast, voz) já recebe o texto trocado; sem apelido o vocativo some e a frase fica natural.
 */
export function fillMission(mission: Mission, nickname: string | null | undefined): Mission {
  const fill = <T extends { text: string; translation: string }>(line: T): T => ({ ...line, text: fillPlayer(line.text, nickname), translation: fillPlayer(line.translation, nickname) });
  return {
    ...mission,
    nodes: mission.nodes.map((node) => ({
      ...fill(node),
      replies: node.replies.map((reply) => (reply.reaction ? { ...reply, reaction: fill(reply.reaction) } : reply)),
    })),
    closing: { ...mission.closing, question: fill(mission.closing.question), success: fill(mission.closing.success) },
  };
}

export async function prepare(missionId: string): Promise<PrepareResult> {
  const loaded = await loadCatalog(missionId);
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const profile = await loadProfile();
  const mission = fillMission(loaded.mission, profile?.nickname || null);
  const db = getDb();
  const day = localDay(getDeps().now());
  const [runs, row] = await Promise.all([listRuns(db), loadSession(db)]);

  const npcs: Record<string, Npc> = Object.create(null);
  const voices: Record<string, Voice> = Object.create(null);
  for (const c of mission.characters) {
    const sheet = c.npc === undefined ? undefined : await loadNpc(c.npc);
    if (sheet) npcs[c.id] = sheet;
    voices[c.id] = sheet ? { lang: sheet.voice.lang, rate: sheet.voice.rate, pitch: sheet.voice.pitch } : FALLBACK_VOICE[mission.target];
  }

  const stars = masteryOf(runs.filter((r) => r.missionId === mission.id));
  const resume = row && row.missionId === mission.id ? parseState(mission, row.state) : null;
  return {
    ok: true,
    prepared: {
      mission,
      voices,
      npcs,
      stars,
      suggested: suggestedMode(stars, mission.kind),
      today: todayLevels(runs, mission.id, resume ? resume.day : day, resume?.runId),
      resume,
      day,
    },
  };
}

/** Começa uma rodada nova (apaga a que estava guardada, de qualquer missão). */
export function startRun(prepared: Prepared, mode: Mode): PlayState {
  const state = start(prepared.mission, { runId: getDeps().uuid(), day: prepared.day, mode: effectiveMode(mode, prepared.mission.kind) });
  void keepSession(state); // a tela não espera o disco: a primeira fala sai do toque
  return state;
}

/** Guarda o passo (retomável). Falha de gravação não derruba a rodada: ela segue, só deixa de ser retomável. */
export async function keepSession(state: PlayState): Promise<void> {
  try {
    await saveSession(getDb(), getDeps(), { missionId: state.missionId, state: state as unknown as Record<string, unknown> });
  } catch {
    // sem onde guardar: a rodada continua nesta tela
  }
}

export async function dropSession(): Promise<void> {
  try {
    await clearSession(getDb());
  } catch {
    // nada a limpar
  }
}

/** O "+N XP" da resposta que acabou de casar. */
export const xpOfStep = (step: Step, today: TodayLevels): number => replyXp(rulesV1, step, today);

// ---------- Falar ----------

/** Fala o texto com a voz do personagem. Sem voz ou sem suporte, devolve `unavailable` e o texto na tela basta. */
export function speak(text: string, voice: Voice) {
  return tts.speak(text, voice);
}
export const stopSpeaking = (): void => tts.cancel();

// ---------- Concluir ----------

/** Texto puro para o registro: sem `<`, `>`, controle ou invisíveis; até `max` caracteres. */
export function plain(text: string, max: number): string {
  return Array.from(text.replace(/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim())
    .slice(0, max)
    .join("");
}

/** Pedido ao navegador para não apagar os dados sozinho (D-46). Só depois da 1ª missão concluída, uma vez. */
const PERSIST_KEY = "glifora.storage.persist-asked";
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // sem onde guardar: pede de novo na próxima missão, o que é inofensivo
  }
}
async function askPersistence(): Promise<void> {
  try {
    if (readFlag(PERSIST_KEY)) return;
    writeFlag(PERSIST_KEY);
    if (typeof navigator !== "undefined" && typeof navigator.storage?.persist === "function") await navigator.storage.persist();
  } catch {
    // o navegador pode negar ou não ter a função: nada a fazer
  }
}

/** Grava a rodada concluída. Idempotente: pode ser chamada de novo depois de uma queda. */
export async function finishRun(mission: Mission, state: PlayState): Promise<{ runId: string }> {
  const closing = state.closing;
  if (state.phase !== "done" || !closing) throw new Error("A rodada ainda não acabou.");
  const db = getDb();
  const deps = getDeps();
  const [runs, events] = await Promise.all([listRuns(db), listEvents(db)]);
  const answers = answersOf(state);
  const plan = planRun({
    rules: rulesV1,
    runId: state.runId,
    missionId: mission.id,
    mission: { kind: mission.kind, level: mission.level },
    day: state.day,
    answers,
    closing,
    history: runs,
    granted: new Set(events.map((e) => e.id)),
  });

  const recasts = new Map<string, number>();
  let flawed = 0;
  for (const s of state.steps) {
    const reply = mission.nodes.find((n) => n.id === s.node)?.replies[s.reply];
    if (!reply?.flawed) continue;
    flawed += 1;
    const id = reply.pattern ?? "other";
    recasts.set(id, (recasts.get(id) ?? 0) + 1);
  }
  const words = mission.vocabulary.map((v) => plain(v.term, 60)).filter((w) => w !== "").slice(0, 30);

  await appendRun(db, deps, {
    id: state.runId,
    day: state.day,
    missionId: mission.id,
    level: state.mode,
    xp: plan.xp,
    rules: rulesV1.version,
    canDo: plan.degree >= 1,
    replies: { good: state.steps.length - flawed, flawed, retry: state.retries },
    recasts: [...recasts].slice(0, 20).map(([pattern, count]) => ({ pattern, count })),
    words,
    answers,
    closing: {
      text: plain(closing.text, 300) || plain(mission.closing.model_answer.text, 300) || "-",
      input: closing.input,
      accepted: closing.accepted,
      usedModel: closing.usedModel,
    },
  });
  for (const e of plan.events) {
    await appendEvent(db, deps, { ...e, id: e.id, kind: e.kind, xp: e.xp, coins: e.coins, rules: e.rules, ref: e.ref, runId: e.runId, day: e.day });
  }
  await clearSession(db);
  void askPersistence();
  return { runId: state.runId };
}

// ---------- Relatório ----------

export interface ReportPattern {
  id: string;
  count: number;
  /** Do catálogo de erros (explicação em pt-BR): pode faltar. */
  title?: string;
  explanation?: string;
  example?: Pattern["example"];
  /** O que a NPC reformulou, da própria missão. */
  recast?: { original: string; corrected: string };
}

export interface Report {
  run: Run;
  mission: Mission;
  /** Estrelas depois desta rodada e antes dela. */
  stars: number;
  starsBefore: number;
  /** XP da conversa (respostas e fecho) e dos prêmios únicos desta rodada. */
  conversationXp: number;
  prizeXp: number;
  patterns: ReportPattern[];
  words: VocabItem[];
  before: Progress;
  after: Progress;
  next: { kind: "again"; mode: Mode } | { kind: "mission"; id: string; title: string } | null;
}

export async function loadReport(runId: string): Promise<Report | null> {
  const db = getDb();
  const [runs, events] = await Promise.all([listRuns(db), listEvents(db)]);
  const run = runs.find((r) => r.id === runId);
  if (!run) return null;
  const loaded = await loadCatalog(run.missionId);
  if (!loaded.ok) return null;
  const mission = loaded.mission;
  const catalog = await loadPatterns({ base: mission.base, target: mission.target });

  const mine = events.filter((e) => e.runId === run.id);
  const priorEvents = events.filter((e) => e.runId !== run.id && e.at <= run.at);
  const before = deriveProgress(priorEvents, rulesV1, run.day);
  const after = deriveProgress([...priorEvents, ...mine], rulesV1, run.day);

  const sameMission = runs.filter((r) => r.missionId === mission.id);
  const starsBefore = masteryOf(sameMission.filter((r) => r.id !== run.id && r.at <= run.at));
  const stars = masteryOf(sameMission.filter((r) => r.id === run.id || r.at <= run.at));
  const prizeXp = mine.filter((e) => e.kind === "mission_first" || e.kind === "mission_star").reduce((sum, e) => sum + e.xp, 0);

  const answered = new Set(run.answers.map((a) => a.node));
  const patterns: ReportPattern[] = run.recasts.map(({ pattern, count }) => {
    const info = catalog?.patterns.find((p) => p.id === pattern);
    const reply = mission.nodes.filter((n) => answered.has(n.id)).flatMap((n) => n.replies).find((r) => r.flawed && (r.pattern ?? "other") === pattern);
    return {
      id: pattern,
      count,
      ...(info ? { title: info.title, explanation: info.explanation, ...(info.example ? { example: info.example } : {}) } : {}),
      ...(reply?.recast ? { recast: { original: reply.recast.original, corrected: reply.recast.corrected } } : {}),
    };
  });
  const words = mission.vocabulary.filter((v) => run.words.includes(plain(v.term, 60)));

  let next: Report["next"] = null;
  if (stars < 3 && mission.kind !== "boss") {
    next = { kind: "again", mode: suggestedMode(stars, mission.kind) };
  } else {
    const siblings = await listCatalog({ base: mission.base, target: mission.target });
    const after1 = siblings[siblings.findIndex((e) => e.id === mission.id) + 1];
    if (after1) next = { kind: "mission", id: after1.id, title: after1.title };
  }
  return { run, mission, stars, starsBefore, conversationXp: run.xp, prizeXp, patterns, words, before, after, next };
}
