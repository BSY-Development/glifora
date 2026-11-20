import { describe, expect, it } from "vitest";
import { checkVersion, compareHeaders, describeMismatches, presentDetached, splitDetached } from "./verifyDeploy.ts";

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

describe("cabeçalhos que o _headers manda tirar (D-46)", () => {
  const FILE_DETACH = ["/*", "  X-Test: um", "  ! Report-To", "  ! NEL", "", "/assets/*", "  ! Server-Timing", ""].join("\n");

  it("acusa os que chegaram mesmo assim, só do bloco /*", () => {
    const received = new Headers({ "x-test": "um", nel: "{}", "report-to": "{}", "server-timing": "x" });
    expect(presentDetached(FILE_DETACH, received)).toEqual(["report-to", "nel"]);
  });

  it("vazio quando nenhum chegou, e o ! não vira cabeçalho a exigir", () => {
    expect(presentDetached(FILE_DETACH, new Headers({ "x-test": "um" }))).toEqual([]);
    expect(compareHeaders(FILE_DETACH, new Headers({ "x-test": "um" }))).toEqual([]);
  });
});

describe("erro ou aviso (D-46)", () => {
  it("Access-Control-Allow-Origin voltar é erro; Report-To e NEL são aviso", () => {
    expect(splitDetached(["access-control-allow-origin", "report-to", "nel"])).toEqual({
      errors: ["access-control-allow-origin"],
      warnings: ["report-to", "nel"],
    });
    expect(splitDetached([])).toEqual({ errors: [], warnings: [] });
  });
});
