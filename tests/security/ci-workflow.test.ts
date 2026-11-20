// CI/deploy (W1-13): guardas de texto sobre .github/workflows/ci.yml. Sem parser YAML (nada novo no projeto):
// o arquivo é dividido por job e por passo pela indentação, que é estável neste repositório.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(".github/workflows/ci.yml", "utf8").replace(/\r\n/g, "\n");
const lines = text.split("\n");
const code = lines.filter((l) => !l.trim().startsWith("#"));

/** Trecho de um job (de `  nome:` até o próximo job de 2 espaços). */
function job(name: string): string {
  const start = lines.findIndex((l) => l === `  ${name}:`);
  expect(start, `job ${name}`).toBeGreaterThan(-1);
  let end = lines.findIndex((l, i) => i > start && /^ {2}[a-z0-9_-]+:/.test(l));
  if (end === -1) end = lines.length;
  return lines.slice(start, end).join("\n");
}

/** Passos de um job: blocos que começam em `      - `. */
function steps(body: string): string[] {
  return body.split(/\n(?= {6}- )/).slice(1);
}

describe("ci.yml", () => {
  it("nunca usa pull_request_target nem workflow_run", () => {
    expect(code.join("\n")).not.toMatch(/pull_request_target|workflow_run/);
  });

  it("toda action externa vem presa a um SHA de 40 hex", () => {
    const uses = code.filter((l) => /^\s*-?\s*uses:/.test(l));
    expect(uses.length).toBeGreaterThan(0);
    for (const l of uses) expect(l, l).toMatch(/uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\b/);
  });

  it("permissão global é só contents: read, e nenhum job pede mais", () => {
    expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
    const perms = [...text.matchAll(/^\s*permissions:\n((?:\s+[\w-]+: \w+\n)+)/gm)].flatMap((m) => (m[1] ?? "").trim().split("\n").map((s) => s.trim()));
    for (const p of perms) expect(p).toBe("contents: read");
    expect(code.join("\n")).not.toMatch(/permissions:\s*write-all|id-token|:\s*write\b/);
  });

  it("secrets só existem no passo que publica; nenhum outro job ou passo os vê", () => {
    const withSecret = code.map((l, i) => ({ l, i })).filter(({ l }) => /secrets\./.test(l));
    expect(withSecret.length).toBeGreaterThan(0);
    for (const name of ["check", "e2e"]) expect(job(name), name).not.toMatch(/secrets\./);
    const holders = steps(job("deploy")).filter((s) => /secrets\./.test(s));
    expect(holders).toHaveLength(1);
    expect(holders[0]).toMatch(/wrangler@\d+\.\d+\.\d+ pages deploy/);
    expect(code.join("\n")).not.toMatch(/secrets:\s*inherit|toJSON\(secrets\)|secrets\[/);
    // Só os dois nomes esperados, e nunca dentro de `run:`.
    expect([...new Set(text.match(/secrets\.\w+/g))].sort()).toEqual(["secrets.CLOUDFLARE_ACCOUNT_ID", "secrets.CLOUDFLARE_API_TOKEN"]);
    for (const l of code) if (/^\s*run:/.test(l)) expect(l).not.toMatch(/secrets\./);
  });

  it("o passo de conferência não tem secret e o de publicar não imprime nada com eles", () => {
    const [verify] = steps(job("deploy")).filter((s) => /verify-deploy/.test(s));
    expect(verify).toBeDefined();
    expect(verify).not.toMatch(/secrets\.|CLOUDFLARE_/);
    for (const s of steps(job("deploy"))) expect(s, "eco de variável de ambiente").not.toMatch(/\b(echo|printenv|env\b\s*$|set -x)/m);
  });

  it("deploy: só push na main, depois de check e e2e, no ambiente production", () => {
    const d = job("deploy");
    expect(d).toMatch(/if:\s*\$\{\{\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\s*\}\}/);
    expect(d).toMatch(/needs:\s*\[check, e2e\]/);
    expect(d).toMatch(/environment:\n\s+name: production/);
    expect(d).toMatch(/permissions:\n\s+contents: read/);
  });

  it("deploy publica o artefato do check: sem build novo, sem npm ci", () => {
    const d = job("deploy");
    expect(d).toMatch(/download-artifact@/);
    expect(d).not.toMatch(/npm (ci|install|run build)|vite build/);
    expect(job("check")).toMatch(/upload-artifact@[\s\S]*name: dist/);
  });

  it("wrangler com versão exata, fora do package.json, sem scripts de instalação", () => {
    expect(text).toMatch(/npx --yes wrangler@\d+\.\d+\.\d+ pages deploy dist /);
    expect(text).not.toMatch(/wrangler(@latest|@\^|@~|\s+pages)/); // sempre com versão fixa
    expect(readFileSync("package.json", "utf8")).not.toMatch(/wrangler/);
    expect(readFileSync(".npmrc", "utf8")).toMatch(/^ignore-scripts=true$/m);
  });

  it("nenhum run usa conteúdo controlável por quem abre PR (injeção em script)", () => {
    // ${{ github.head_ref }}, títulos, mensagens de commit, etc. dentro de `run:` viram código no shell.
    const runs = steps(text).map((s) => s.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"));
    for (const s of runs) {
      const run = s.match(/\n\s+run:[\s\S]*?(?=\n\s+(?:env|with|if|name|uses):|$)/)?.[0] ?? "";
      expect(run, run).not.toMatch(/\$\{\{\s*(github\.(head_ref|event\.|actor)|inputs\.)/);
    }
  });

  it("main nunca é cancelada no meio; PR é", () => {
    expect(text).toMatch(/cancel-in-progress:\s*\$\{\{\s*github\.ref != 'refs\/heads\/main'\s*\}\}/);
  });

  it("checkout sem persistir credenciais", () => {
    for (const s of steps(text).filter((x) => /actions\/checkout@/.test(x))) expect(s).toMatch(/persist-credentials:\s*false/);
  });
});
