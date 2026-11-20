import { describe, expect, it } from "vitest";
import { buildDefines, resolveCommit, shortCommit } from "./buildInfo.ts";

const SHA = "60be14a4c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6";

describe("commit do build", () => {
  it("usa o GITHUB_SHA do CI, abreviado", () => {
    expect(resolveCommit({ GITHUB_SHA: SHA }, () => "nao-deveria-chamar")).toBe("60be14a");
  });

  it("sem a variável, usa o git local", () => {
    expect(resolveCommit({}, () => `${SHA}\n`)).toBe("60be14a");
  });

  it("sem git (ou resposta estranha), mostra dev", () => {
    expect(resolveCommit({}, () => undefined)).toBe("dev");
    expect(resolveCommit({ GITHUB_SHA: "" }, () => "fatal: not a git repository")).toBe("dev");
    expect(shortCommit("<script>")).toBe("dev");
  });

  it("define entrega strings JSON", () => {
    expect(buildDefines("0.1.0", "abc1234")).toEqual({ __APP_VERSION__: '"0.1.0"', __APP_COMMIT__: '"abc1234"' });
  });
});
