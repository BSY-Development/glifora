// Missões embutidas (W0-03 §5.3): o índice (gerado pelo build-index, fora do git) diz quais existem; cada missão é um
// pedaço carregado sob demanda e validado pela mesma `parseMission` da fábrica (um caminho só para toda missão).
import { Cefr, ContentLang, LocationId, MissionId, MissionKind, parseMission, type Mission, type MissionIssue } from "../schemas";

/**
 * Uma linha do índice: o que a lista de missões precisa sem abrir a missão. O formato é o do build-index (W2-04).
 * Esta camada não usa pacotes, então a conferência é à mão com os enums de `schemas/`; quando o Conteúdo exportar
 * `CatalogIndex`, ela troca por ele.
 */
export interface CatalogEntry {
  id: string;
  base: ContentLang;
  target: ContentLang;
  level: Cefr;
  kind: MissionKind;
  title: string;
  location: LocationId;
  can_do: string;
  /** Caminho relativo a `content/` (ex.: "missions/pt-BR_en/A1/bakery-01.json"). */
  file: string;
}

const FILE = /^missions\/[A-Za-z0-9_./-]+\.json$/;

function parseEntry(raw: unknown): CatalogEntry | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const id = MissionId.safeParse(r["id"]);
  const base = ContentLang.safeParse(r["base"]);
  const target = ContentLang.safeParse(r["target"]);
  const level = Cefr.safeParse(r["level"]);
  const kind = MissionKind.safeParse(r["kind"]);
  const location = LocationId.safeParse(r["location"]);
  const { title, can_do: canDo, file } = r;
  if (!id.success || !base.success || !target.success || !level.success || !kind.success || !location.success) return undefined;
  if (typeof title !== "string" || typeof canDo !== "string" || typeof file !== "string" || !FILE.test(file) || file.includes("..")) return undefined;
  return { id: id.data, base: base.data, target: target.data, level: level.data, kind: kind.data, title, location: location.data, can_do: canDo, file };
}

/** O arquivo do índice inteiro; qualquer coisa fora do formato vira lista vazia (uma linha ruim é descartada). */
function parseIndex(raw: unknown): CatalogEntry[] {
  if (typeof raw !== "object" || raw === null) return [];
  const { schema, missions } = raw as Record<string, unknown>;
  if (schema !== 1 || !Array.isArray(missions)) return [];
  return missions.flatMap((m) => parseEntry(m) ?? []);
}

export interface CatalogQuery {
  base: ContentLang;
  target: ContentLang;
  level?: Cefr;
  location?: LocationId;
}

export type LoadResult =
  | { ok: true; mission: Mission }
  | { ok: false; reason: "unknown" | "missing" | "invalid"; issues: readonly MissionIssue[] };

/** Onde estão o índice e os pedaços. Em produção vêm do `import.meta.glob`; nos testes, de um fixture. */
export interface CatalogSources {
  readIndex: () => Promise<unknown>;
  /** Chave = "/content/" + `file` do índice. */
  files: Readonly<Record<string, () => Promise<unknown>>>;
}

const issue = (message: string): MissionIssue[] => [{ path: "", message }];

export function createMissionCatalog(sources: CatalogSources) {
  let index: Promise<readonly CatalogEntry[]> | undefined;
  const loaded = new Map<string, Mission>();

  function readIndex(): Promise<readonly CatalogEntry[]> {
    index ??= sources
      .readIndex()
      .then((raw) => {
        return parseIndex(raw);
      })
      .catch(() => {
        index = undefined; // falha transitória: tenta de novo na próxima chamada
        return [];
      });
    return index;
  }

  return {
    /** As missões do par, na ordem do índice (par, nível, id). Sem índice (build sem conteúdo): lista vazia. */
    async list(query: CatalogQuery): Promise<CatalogEntry[]> {
      const all = await readIndex();
      return all.filter(
        (e) => e.base === query.base && e.target === query.target && (query.level === undefined || e.level === query.level) && (query.location === undefined || e.location === query.location),
      );
    },

    /** Abre a missão e confere de novo com o schema. Um erro vira resultado, nunca exceção. */
    async load(id: string): Promise<LoadResult> {
      const cached = loaded.get(id);
      if (cached !== undefined) return { ok: true, mission: cached };
      const entry = (await readIndex()).find((e) => e.id === id);
      if (entry === undefined) return { ok: false, reason: "unknown", issues: [] };
      const open = sources.files[`/content/${entry.file}`];
      if (open === undefined) return { ok: false, reason: "missing", issues: [] };
      let raw: unknown;
      try {
        raw = await open();
      } catch {
        return { ok: false, reason: "missing", issues: [] };
      }
      const parsed = parseMission(raw, { origin: "builtin" });
      if (!parsed.ok) return { ok: false, reason: "invalid", issues: parsed.issues };
      if (parsed.mission.id !== entry.id) return { ok: false, reason: "invalid", issues: issue(`o id do arquivo (${parsed.mission.id}) não bate com o do índice (${entry.id})`) };
      loaded.set(id, parsed.mission);
      return { ok: true, mission: parsed.mission };
    },
  };
}
