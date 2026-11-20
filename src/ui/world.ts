// Como cada local e cada NPC aparece na tela: nome, texto e desenho. Os dados (quais existem e quem mora onde)
// vêm de content/world/locations.json pelo catálogo; o rótulo e o sprite ficam no código (schemas/world.ts).
import type { MessageKey } from "../i18n";
import type { LocationId } from "../schemas";
import type { Art } from "./art/sprites";
import { BAKERY, TILDA } from "./art/sprites";

export const PLACE_NAME = { bakery: "place.bakery" } as const satisfies Record<LocationId, MessageKey>;
export const PLACE_ABOUT = { bakery: "place.bakery.about" } as const satisfies Record<LocationId, MessageKey>;
export const PLACE_ART = { bakery: BAKERY } as const satisfies Record<LocationId, Art>;

export interface NpcView {
  name: MessageKey;
  role: MessageKey;
  art: Art;
}

/** NPCs que já têm rosto. Um id desconhecido no JSON simplesmente não aparece. */
const NPCS: Readonly<Record<string, NpcView>> = {
  tilda: { name: "npc.tilda.name", role: "npc.tilda.role", art: TILDA },
};

export function npcView(id: string): NpcView | undefined {
  return Object.hasOwn(NPCS, id) ? NPCS[id] : undefined;
}
