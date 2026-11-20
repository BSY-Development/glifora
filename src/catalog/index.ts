// Conteúdo embutido (W0-03 §5.3): o mapa da vila, o índice e as missões (fase 2) e as frases do teste de voz (D-48).
// Tudo que vem de content/ passa pelo schema antes de sair daqui.
import { World, type Location, type Pair } from "../schemas";
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
