import { describe, expect, it } from "vitest";
import { Pair, pairId } from "./lang";

describe("Pair", () => {
  it("monta o id do par", () => {
    expect(pairId(Pair.parse({ base: "pt-BR", target: "en" }))).toBe("pt-BR_en");
  });

  it("recusa base igual ao alvo e idioma fora da lista", () => {
    expect(Pair.safeParse({ base: "en", target: "en" }).success).toBe(false);
    expect(Pair.safeParse({ base: "pt-BR", target: "fr" }).success).toBe(false);
  });
});
