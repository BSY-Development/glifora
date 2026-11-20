// Conteúdo embutido (W0-03 §5.3). Por enquanto só o mapa da vila; as missões chegam na fase 2.
// Tudo que vem de content/ passa pelo schema antes de sair daqui.
import { World, type Location } from "../schemas";

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
