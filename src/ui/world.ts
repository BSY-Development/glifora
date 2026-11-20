// Como cada local e cada NPC aparece na tela: nome, texto e desenho. Os dados (quais existem e quem mora onde)
// vêm de content/world/locations.json pelo catálogo; o rótulo e o sprite ficam no código (schemas/world.ts).
import type { MessageKey } from "../i18n";
import type { LocationId } from "../schemas";
import type { Art } from "./art/sprites";
import { BAKERY, BRAM, TAVERN, TILDA } from "./art/sprites";

export const PLACE_NAME = { bakery: "place.bakery", tavern: "place.tavern" } as const satisfies Record<LocationId, MessageKey>;
export const PLACE_ABOUT = { bakery: "place.bakery.about", tavern: "place.tavern.about" } as const satisfies Record<LocationId, MessageKey>;
export const PLACE_ART = { bakery: BAKERY, tavern: TAVERN } as const satisfies Record<LocationId, Art>;

export interface NpcView {
  name: MessageKey;
  role: MessageKey;
  art: Art;
}

/** NPCs que já têm rosto. Um id desconhecido no JSON simplesmente não aparece. */
const NPCS: Readonly<Record<string, NpcView>> = {
  tilda: { name: "npc.tilda.name", role: "npc.tilda.role", art: TILDA },
  bram: { name: "npc.bram.name", role: "npc.bram.role", art: BRAM },
};

export function npcView(id: string): NpcView | undefined {
  return Object.hasOwn(NPCS, id) ? NPCS[id] : undefined;
}
