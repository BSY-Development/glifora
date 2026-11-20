// Conteúdo embutido (W0-03 §5.3): o mapa da vila, o índice e as missões (fase 2) e as frases do teste de voz (D-48).
// Tudo que vem de content/ passa pelo schema antes de sair daqui.
import { Npc, PatternCatalog, World, pairId, type Location, type Pair } from "../schemas";
import { createMissionCatalog, type CatalogEntry, type CatalogQuery, type LoadResult } from "./missions";
import { loadVoicePhrasesFrom, type VoicePhrasesResult } from "./voice";

export { createMissionCatalog, type CatalogEntry, type CatalogQuery, type CatalogSources, type LoadResult } from "./missions";
export { loadVoicePhrasesFrom, type VoicePhrase, type VoicePhrasesResult } from "./voice";

const files = import.meta.glob("../../content/world/locations.json", { eager: true, import: "default" });

const world = World.parse(Object.values(files)[0]);
const LOCATIONS: readonly Location[] = [...world.locations].sort((a, b) => a.order - b.order);

/** Os locais da vila, na ordem do mapa. */
export function listLocations(): readonly Location[] {
  return LOCATIONS;
}

/** O local com esse id, ou `undefined` (id vindo da URL pode ser qualquer coisa). */
export function findLocation(id: string): Location | undefined {
  return LOCATIONS.find((location) => location.id === id);
}

// O índice é gerado pelo build-index (src/catalog/generated/, fora do git). Sem ele o glob vem vazio: lista vazia.
// Cada missão e o arquivo de frases viram pedaços separados, abertos só quando pedidos.
const indexFiles = import.meta.glob("./generated/index.json", { import: "default" });
const missionFiles = import.meta.glob("/content/missions/**/*.json", { import: "default" });
const voiceFiles = import.meta.glob("/content/eval/stt/*.json", { import: "default" });

const missions = createMissionCatalog({
  readIndex: async () => {
    const open = Object.values(indexFiles)[0];
    return open === undefined ? undefined : open();
  },
  files: missionFiles,
});

/** As missões do par, na ordem de jogo (par, nível, id). */
export function list(query: CatalogQuery): Promise<CatalogEntry[]> {
  return missions.list(query);
}

/** A missão do id, validada. Erro vira resultado, não exceção. */
export function load(id: string): Promise<LoadResult> {
  return missions.load(id);
}

/** As frases do teste de voz do par. Só a tela /settings/voice chama. */
export function loadVoicePhrases(pair: Pair): Promise<VoicePhrasesResult> {
  return loadVoicePhrasesFrom(voiceFiles, pair);
}

// Fichas de NPC e catálogo de erros do par: pedaços preguiçosos, validados na hora de abrir.
const npcFiles = import.meta.glob("/content/npcs/*.json", { import: "default" });
const patternFiles = import.meta.glob("/content/patterns/*.json", { import: "default" });

/** A ficha da NPC (voz, `lines.<alvo>.retry`), ou `undefined` se não existe ou não passa no schema. */
export async function loadNpc(id: string): Promise<Npc | undefined> {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(id)) return undefined;
  const open = npcFiles[`/content/npcs/${id}.json`];
  if (open === undefined) return undefined;
  try {
    const parsed = Npc.safeParse(await open());
    return parsed.success && parsed.data.id === id ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** O catálogo de erros do par (explicação de cada padrão, só no relatório), ou `undefined`. */
export async function loadPatterns(pair: Pair): Promise<PatternCatalog | undefined> {
  const open = patternFiles[`/content/patterns/${pairId(pair)}.json`];
  if (open === undefined) return undefined;
  try {
    const parsed = PatternCatalog.safeParse(await open());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
