import { describe, expect, it } from "vitest";
import { SW_URL, createSwPolicy, swScriptUrl } from "./sw-register";

function fakeFactory() {
  const created: string[] = [];
  return {
    created,
    createPolicy(name: string, rules: { createScriptURL(input: string): string }) {
      created.push(name);
      return { createScriptURL: (input: string) => rules.createScriptURL(input) };
    },
  };
}

describe("política Trusted Types glifora-sw", () => {
  it("só aceita exatamente /sw.js", () => {
    const policy = createSwPolicy(fakeFactory());
    expect(policy.createScriptURL(SW_URL)).toBe("/sw.js");
    for (const other of ["/sw.js?x=1", "sw.js", "/other.js", "https://evil.example/sw.js", "//evil.example/sw.js", "/sw.js/", ""]) {
      expect(() => policy.createScriptURL(other), other).toThrow(TypeError);
    }
  });

  it("cria uma política só, chamada glifora-sw (nunca 'default')", () => {
    const factory = fakeFactory();
    swScriptUrl(factory);
    expect(factory.created).toEqual(["glifora-sw"]);
  });

  it("sem Trusted Types no navegador, passa a string direto", () => {
    expect(swScriptUrl(undefined)).toBe("/sw.js");
  });
});
