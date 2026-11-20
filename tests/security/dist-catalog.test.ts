// W2-11 — o build tem que levar o catálogo de missões. O 53dc4bb passou no CI com o índice vazio (o .npmrc tem
// ignore-scripts=true, então os hooks pre* não rodaram) e o e2e não percebeu. Roda depois de `npm run build`;
// com REQUIRE_DIST=1 (CI) a falta do dist/ falha. Dono: Revisor.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = "dist";
const has = existsSync(join(DIST, "index.html"));
if (!has && process.env["REQUIRE_DIST"]) throw new Error("REQUIRE_DIST=1 mas dist/ não existe: rode `npm run build` antes.");

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const base = (f: string): string => (f.split(/[\\/]/).pop() ?? "").replace(/\.json$/, "");
const sourceIds = existsSync("content/missions") ? walk("content/missions").filter((f) => f.endsWith(".json")).map(base) : [];

describe.skipIf(!has)("dist/ leva o catálogo de missões", () => {
  const assets = has ? readdirSync(join(DIST, "assets")) : [];
  it("há missões no conteúdo (o teste não pode passar com zero)", () => {
    expect(sourceIds.length).toBeGreaterThanOrEqual(1);
    expect(sourceIds).toContain("bakery-01");
  });
  it("cada missão do conteúdo virou um pedaço do build (dist/assets/<id>-*.js)", () => {
    for (const id of sourceIds) expect(assets.some((a) => a.startsWith(`${id}-`) && a.endsWith(".js")), `sem dist/assets/${id}-*.js`).toBe(true);
  });
  it("o índice gerado está no build e lista todas as missões", () => {
    // O Vite põe o index.json no pedaço `generated-<hash>.js`; sem o índice gerado esse pedaço não existe.
    const chunks = assets.filter((a) => a.startsWith("generated-") && a.endsWith(".js")).map((a) => readFileSync(join(DIST, "assets", a), "utf8"));
    expect(chunks.length, "dist/assets/generated-*.js não existe: o build-index não rodou antes do vite build").toBeGreaterThanOrEqual(1);
    for (const id of sourceIds) expect(chunks.some((c) => ["\"", "`", "'"].some((q) => c.includes(`id:${q}${id}${q}`) || c.includes(`"id":${q}${id}${q}`))), `o índice do dist/ não lista ${id}`).toBe(true);
  });
});
