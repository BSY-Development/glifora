import { describe, expect, it } from "vitest";
import world from "../../content/world/locations.json";
import { World } from "./world";

describe("World (content/world/locations.json)", () => {
  it("o arquivo da vila é válido e tem a padaria", () => {
    const parsed = World.parse(world);
    expect(parsed.locations.map((l) => l.id)).toContain("bakery");
  });

  it("recusa campo desconhecido", () => {
    expect(World.safeParse({ ...world, extra: true }).success).toBe(false);
  });

  it("recusa local repetido", () => {
    const loc = { id: "bakery", order: 0, npcs: [] };
    expect(World.safeParse({ schema: 1, locations: [loc, loc] }).success).toBe(false);
  });

  it("recusa local fora da lista e versão de schema desconhecida", () => {
    expect(World.safeParse({ schema: 1, locations: [{ id: "castle", order: 0, npcs: [] }] }).success).toBe(false);
    expect(World.safeParse({ ...world, schema: 2 }).success).toBe(false);
  });
});
