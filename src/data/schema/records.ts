// Registros (só se acrescenta, nunca muda) e a sessão em andamento, versão do banco 2 (W0-03 §4.1).
// `events` é o livro-razão de XP e moedas; `runs`, a rodada concluída com o resumo para o relatório;
// `session`, a rodada em andamento (só local, nunca exportada).
// Os limites abaixo valem na importação. É um app local: eles só barram o absurdo (número negativo, fracionado, gigante), não impedem quem edita o próprio arquivo.
import { z } from "zod";

const Flag = z.union([z.literal(0), z.literal(1)]);

/** Id seguro: uuid ou determinístico ("ach:first_boss", "<alvo>:<termo>"). Sem espaço, `<` nem `>`. */
export const RecordId = z.string().regex(/^[A-Za-z0-9_.:-]{1,120}$/, { message: "id com letras, números e _ . : - (até 120)" });
const Device = z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/, { message: "id do aparelho inválido" });

/** Dia local "YYYY-MM-DD" que existe no calendário. */
export const Day = z.string().refine(
  (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  },
  { message: "dia no formato AAAA-MM-DD" },
);

/** Texto puro curto: sem `<`, `>`, controle, formato (bidi, largura zero) nem separador de linha. */
const FORBIDDEN_TEXT = /[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const PlainText = (max: number) =>
  z
    .string()
    .min(1)
    .refine((s) => Array.from(s).length <= max, { message: `no máximo ${max} caracteres` })
    .refine((s) => !FORBIDDEN_TEXT.test(s), { message: "sem < nem >, e sem caracteres de controle ou invisíveis" });

/**
 * Teto de XP e de moedas GANHAS por um único evento (D-49). Nas regras v1, nenhum evento legítimo passa de
 * 344 XP (rodada de 20 falas) nem de 50 moedas; o teto só barra o absurdo, não impede quem edita o próprio arquivo.
 */
export const EVENT_MAX_XP = 400;
export const EVENT_MAX_COINS = 100;
/** Quanto uma compra (`purchase`) pode gastar de uma vez. */
export const EVENT_MAX_SPEND = 10_000;
/** Versão das regras: inteiro pequeno. */
const Rules = z.number().int().min(1).max(10_000);

export const EVENT_KINDS = [
  "mission_completed",
  "boss_defeated",
  "mission_first",
  "mission_star",
  "daily_completed",
  "spell_cast",
  "achievement",
  "purchase",
  "freeze_earned",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Linha de `events`: um prêmio ou gasto. XP gravado já calculado, com a versão das regras que o calculou. */
const EventBase = z.strictObject({
    /** uuid, ou determinístico para prêmio único ("ach:first_boss"). */
    id: RecordId,
    /** Epoch ms. */
    at: z.number().int().nonnegative(),
    /** Dia local do momento; a ofensiva usa isto. */
    day: Day,
    kind: z.enum(EVENT_KINDS),
    /** ≥ 0, já calculado. */
    xp: z.number().int().min(0).max(EVENT_MAX_XP),
    /** ≥ 0; negativo só em `purchase`. */
    coins: z.number().int().min(-EVENT_MAX_SPEND).max(EVENT_MAX_COINS),
    rules: Rules,
    target: RecordId.optional(),
    ref: RecordId.optional(),
    runId: RecordId.optional(),
    device: Device,
    /** 1 = já enviado ao servidor (fase 5). Marca local, não viaja no arquivo. */
    synced: Flag,
});
const coinsByKind = (e: { kind: EventKind; coins: number; xp: number }): boolean =>
  e.kind === "purchase" ? e.coins <= 0 && e.xp === 0 : e.coins >= 0;
const COINS_RULE = { message: "moeda negativa só em purchase, e purchase só gasta (sem ganhar moeda nem XP)", path: ["coins"] };
export const GameEvent = EventBase.refine(coinsByKind, COINS_RULE);
export type GameEvent = z.infer<typeof GameEvent>;

/** Degrau de domínio da rodada (D-43): 1 frases à vista · 2 só a ideia no idioma base · 3 sem nada. */
export const RUN_LEVELS = [1, 2, 3] as const;

/** Como a resposta foi dada: falando, digitando ou tocando. */
export const INPUT_MODES = ["voice", "typed", "tap"] as const;
const InputMode = z.enum(INPUT_MODES);
/** Uma missão tem no máximo 20 falas (`MISSION_LIMITS.nodes.max`). */
export const MAX_RUN_ANSWERS = 20;
const RunAnswer = z.strictObject({
  /** Id da fala (`MissionNode.id`). */
  node: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/, { message: "id de fala: minúsculas, números, - e _ (1 a 32)" }),
  input: InputMode,
  /** 0 sem ajuda · 1 ideia · 2 frase à vista · 3 tocou. */
  scaffold: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  /** Posição da resposta casada em `replies` da fala (a missão tem no máximo 3). */
  reply: z.number().int().min(0).max(2).optional(),
  /** O que a pessoa disse ou digitou nesta fala (texto puro, até 100 caracteres; D-55). Falta em rodadas antigas e nos toques. */
  said: PlainText(100).optional(),
});

/** Linha de `runs`: o resumo de uma rodada concluída, o suficiente para o relatório. */
export const Run = z.strictObject({
  id: RecordId,
  missionId: RecordId,
  at: z.number().int().nonnegative(),
  day: Day,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  xp: z.number().int().min(0).max(EVENT_MAX_XP),
  rules: Rules,
  /** Cumpriu o "consigo...". */
  canDo: z.boolean(),
  /** Quantas respostas de cada tipo. */
  replies: z.strictObject({
    good: z.number().int().min(0).max(500),
    flawed: z.number().int().min(0).max(500),
    retry: z.number().int().min(0).max(500),
  }),
  /** Erros que a NPC reformulou: id do padrão (para a explicação do relatório) e quantas vezes. */
  recasts: z.array(z.strictObject({ pattern: RecordId, count: z.number().int().min(1).max(500) })).max(20),
  /** Palavras novas da rodada. */
  words: z.array(PlainText(60)).max(30),
  /**
   * As respostas que casaram, na ordem em que vieram (`node` = id da fala). Delas saem o `repeat` e a estrela (D-49).
   * `scaffold` é o degrau em vigor quando a resposta casou.
   */
  answers: z.array(RunAnswer).max(MAX_RUN_ANSWERS),
  /** A frase do fecho ao lado da resposta-modelo (`usedModel`: a pessoa viu o modelo) e como foi dita. */
  closing: z.strictObject({ text: PlainText(300), input: InputMode, accepted: z.boolean(), usedModel: z.boolean() }).optional(),
  device: Device,
  synced: Flag,
});
export type Run = z.infer<typeof Run>;

/** Como o registro viaja no arquivo: sem `synced`, que é marca local. */
export const EventFile = EventBase.omit({ synced: true }).refine(coinsByKind, COINS_RULE);
export type EventFile = z.infer<typeof EventFile>;
export const RunFile = Run.omit({ synced: true });
export type RunFile = z.infer<typeof RunFile>;

/**
 * Limites do que cabe num arquivo, para que um arquivo exportado no limite ainda caiba nos 20 MB da importação.
 * Um evento ocupa uns 400 bytes (~10–30 por dia de jogo: anos de uso); uma rodada cheia, uns 3,5 KB.
 * No limite, os dois somam cerca de 14 MB.
 */
export const MAX_EVENTS = 25_000;
export const MAX_RUNS = 2_000;

/** Linha de `session`: a rodada em andamento. Só local; o conteúdo de `state` é do player (W2-08). */
export const SESSION_STATE_MAX_BYTES = 32 * 1024;
export const SessionRow = z.strictObject({
  /** Uma rodada por vez: id "current". */
  id: z.literal("current"),
  v: z.number().int().min(1),
  missionId: RecordId,
  updatedAt: z.number().int().nonnegative(),
  state: z.record(z.string(), z.unknown()),
});
export type SessionRow = z.infer<typeof SessionRow>;
