import { describe, expect, it } from "vitest";
import { checkVersion, compareHeaders, describeMismatches } from "./verifyDeploy.ts";

const FILE = "/*\n  X-Test: um\n  Content-Security-Policy: default-src 'none'\n\n/assets/*\n  Cache-Control: immutable\n";

describe("conferência dos cabeçalhos", () => {
  it("passa com os valores exatos, mesmo com cabeçalho a mais", () => {
    const received = new Headers({ "x-test": "um", "content-security-policy": "default-src 'none'", server: "cloudflare" });
    expect(compareHeaders(FILE, received)).toEqual([]);
  });

  it("acusa ausente e valor diferente, e mostra a diferença", () => {
    const received = new Headers({ "content-security-policy": "default-src 'self'" });
    const result = compareHeaders(FILE, received);
    expect(result.map((m) => m.name)).toEqual(["X-Test", "Content-Security-Policy"]);
    const text = describeMismatches(result);
    expect(text).toContain("(ausente)");
    expect(text).toContain("recebido: default-src 'self'");
  });

  it("só olha o bloco /* (o de /assets/* não vale para a página)", () => {
    expect(compareHeaders(FILE, new Headers({ "x-test": "um", "content-security-policy": "default-src 'none'" }))).toEqual([]);
  });
});

describe("version.json", () => {
  it("exige o commit da rodada", () => {
    expect(checkVersion({ version: "0.1.0", commit: "abc1234" }, "abc1234")).toBeNull();
    expect(checkVersion({ commit: "velho" }, "abc1234")).toContain("esperado: abc1234");
    expect(checkVersion(null, "abc1234")).not.toBeNull();
    expect(checkVersion("x", "abc1234")).not.toBeNull();
  });
});
