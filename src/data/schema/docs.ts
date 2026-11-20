// Linhas da tabela `docs` e o conteúdo (`data`) de cada documento, versão 1 (W0-03 §4.1, D-41).
// Schemas do App (não do Conteúdo): descrevem o que o jogo guarda sobre a pessoa neste aparelho.
import { z } from "zod";
import { ContentLang, UiLang } from "../../schemas";

const Flag = z.union([z.literal(0), z.literal(1)]);

/** Linha da tabela `docs`: documento com dono único, o último a escrever vence (`updatedAt`). */
export const DocRow = z.strictObject({
  id: z.string().min(1).max(120),
  /** Versão do formato de `data`. Funções puras vN → vN+1 aplicam-se ao ler. */
  v: z.number().int().min(1),
  data: z.record(z.string(), z.unknown()),
  /** Epoch ms da última escrita. Sempre sobe: duas escritas no mesmo milissegundo ainda se ordenam. */
  updatedAt: z.number().int().nonnegative(),
  /** 1 = apagado (lápide, para a mescla e a sincronização saberem). */
  deleted: Flag,
  /** 1 = mudou aqui e ainda não foi enviado. É índice porque o Dexie não indexa booleano. */
  dirty: Flag,
});
export type DocRow = z.infer<typeof DocRow>;

/** Documento como viaja no arquivo exportado: sem `dirty`, que é marca local. */
export const SyncDoc = DocRow.omit({ dirty: true });
export type SyncDoc = z.infer<typeof SyncDoc>;

/** Linha da tabela `meta`: só local, nunca exportada nem sincronizada. */
export const MetaRow = z.strictObject({ key: z.string().min(1).max(60), value: z.unknown() });
export type MetaRow = z.infer<typeof MetaRow>;

// ---------- Conteúdo dos documentos ----------

export const NICKNAME_MAX = 30;

export const ProfileV1 = z.strictObject({
  /** Apelido opcional ("" = sem apelido). Texto puro. */
  nickname: z.string().refine((s) => Array.from(s).length <= NICKNAME_MAX, { message: `no máximo ${NICKNAME_MAX} caracteres` }),
  createdAt: z.number().int().nonnegative(),
});
export type Profile = z.infer<typeof ProfileV1>;

export const REDUCE_MOTION = ["system", "on", "off"] as const;
export const TEXT_SIZES = ["normal", "large", "xlarge"] as const;

export const PrefsV1 = z.strictObject({
  /** Espelho do idioma da interface. A leitura síncrona do boot continua no localStorage (W1-05). */
  uiLang: UiLang.nullable(),
  /** Idioma das traduções e dicas. `null` = acompanha a interface (SPEC). */
  baseLang: ContentLang.nullable(),
  reduceMotion: z.enum(REDUCE_MOTION),
  sounds: z.boolean(),
  textSize: z.enum(TEXT_SIZES),
});
export type Prefs = z.infer<typeof PrefsV1>;
export const DEFAULT_PREFS: Prefs = { uiLang: null, baseLang: null, reduceMotion: "system", sounds: true, textSize: "normal" };

export const AVATAR_FIGURES = ["a", "b", "c", "d"] as const;
export const AvatarV1 = z.strictObject({ figure: z.enum(AVATAR_FIGURES) });
export type Avatar = z.infer<typeof AvatarV1>;
export const DEFAULT_AVATAR: Avatar = { figure: "a" };
