import { z } from "zod";

/** Locais da vila. O nome de cada um é texto de interface (i18n: place.<id>); o sprite vem do código, nunca do JSON. */
export const LocationId = z.enum(["bakery", "tavern"]);
export type LocationId = z.infer<typeof LocationId>;

/** Id curto em minúsculas (NPC, missão embutida). */
export const Slug = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, "use minúsculas, números e hífen (2 a 40)");

/** NPCs com ficha em content/npcs/<id>.json. Cresce junto com a arte de cada um (o sprite vem do código). */
export const NpcId = z.enum(["tilda", "bram"]);
export type NpcId = z.infer<typeof NpcId>;

export const Location = z.strictObject({
  id: LocationId,
  order: z.number().int().min(0),
  npcs: z.array(NpcId).max(6),
});
export type Location = z.infer<typeof Location>;

/** content/world/locations.json */
export const World = z
  .strictObject({
    schema: z.literal(1),
    locations: z.array(Location).min(1).max(40),
  })
  .superRefine((world, ctx) => {
    const seen = new Set<string>();
    world.locations.forEach((loc, i) => {
      if (seen.has(loc.id)) ctx.addIssue({ code: "custom", message: `local repetido: ${loc.id}`, path: ["locations", i, "id"] });
      seen.add(loc.id);
    });
  });
export type World = z.infer<typeof World>;
