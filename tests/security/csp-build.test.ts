// CSP — build (W0-03 §7): varre dist/ atrás de tudo que a CSP bloquearia ou que indica rede inesperada.
// Roda depois de `npm run build`. Sem dist/ o teste é pulado; com REQUIRE_DIST=1 (CI, depois do build) ele FALHA.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = "dist";
const has = existsSync(join(DIST, "index.html"));
if (!has && process.env["REQUIRE_DIST"]) throw new Error("REQUIRE_DIST=1 mas dist/ não existe: rode `npm run build` antes.");

/** URLs http(s) que podem aparecer como TEXTO nos JS (não são chamadas de rede). Ampliar só com revisão. */
const KNOWN_URLS = [
  /^https?:\/\/react\.dev(\/|$)/, // links de erro do React
  /^https?:\/\/reactjs\.org(\/|$)/,
  /^https?:\/\/www\.w3\.org\/(1999\/xhtml|2000\/svg|1998\/Math\/MathML|1999\/xlink|XML\/1998\/namespace)$/, // namespaces XML
  // W1-07/08/09: strings das bibliotecas empacotadas (sem fetch; a CSP barra de qualquer forma). Exatas de propósito: URL nova = revisão.
  /^https:\/\/reactrouter\.com\/en\/main\/routers\/picking-a-router\.?$/, // react-router: texto de aviso
  /^http:\/\/\[\$\{e\}\]$/, // zod: monta URL só para validar IPv6 (new URL)
  /^https:\/\/json-schema\.org\/draft\/2020-12\/schema$/, // zod: identificadores de $schema
  /^http:\/\/json-schema\.org\/draft-0[47]\/schema#$/,
  /^https:\/\/tinyurl\.com\/y2uuvskb$/, // dexie: texto de erro
  /^http:\/\/bit\.ly\/2kdckMn$/, // dexie: texto de erro
  /^http:\/\/localhost$/, // react-router: base para new URL() ao resolver caminhos
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe.skipIf(!has)("CSP — build (dist/)", () => {
  const files = has ? walk(DIST) : [];
  const html = files.filter((f) => f.endsWith(".html"));
  const js = files.filter((f) => /\.m?js$/.test(f));
  const css = files.filter((f) => f.endsWith(".css"));

  it("há HTML e JS", () => {
    expect(html.length).toBeGreaterThan(0);
    expect(js.length).toBeGreaterThan(0);
  });

  it("nenhum <script> inline, <style>, style=, on*= ou javascript: nos HTML", () => {
    for (const f of html) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/<script\b([^>]*)>/gi)) expect(m[1], `${f}: <script> sem src`).toMatch(/\bsrc\s*=/i);
      for (const m of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) expect(m[1]?.trim(), `${f}: corpo de <script>`).toBe("");
      expect(text, `${f}: <style>`).not.toMatch(/<style\b/i);
      expect(text, `${f}: style=`).not.toMatch(/\sstyle\s*=/i);
      expect(text, `${f}: handler on*=`).not.toMatch(/\son[a-z]+\s*=/i);
      expect(text, `${f}: javascript:`).not.toMatch(/javascript:/i);
      expect(text, `${f}: meta refresh`).not.toMatch(/http-equiv\s*=\s*["']?refresh/i);
    }
  });

  it("src e href do HTML só apontam para o próprio site", () => {
    for (const f of html) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*\s(?:src|href)\s*=\s*["']?([^"'\s>]+)/gi)) {
        const url = m[1] ?? "";
        expect(url, `${f}: ${url}`).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i);
      }
    }
  });

  it("nenhum data: em CSS nem em HTML", () => {
    for (const f of [...css, ...html]) expect(readFileSync(f, "utf8"), f).not.toMatch(/url\(\s*["']?data:|(?:src|href)\s*=\s*["']?data:/i);
  });

  it("nenhuma URL http(s):// nos JS fora da lista conhecida", () => {
    const found = new Set<string>();
    for (const f of js) {
      for (const m of readFileSync(f, "utf8").matchAll(/https?:\/\/[^\s"'`\\)<>]+/g)) {
        const url = m[0];
        if (!KNOWN_URLS.some((re) => re.test(url))) found.add(`${f}: ${url}`);
      }
    }
    expect([...found]).toEqual([]);
  });

  it("nenhum import() nem importScripts de URL remota", () => {
    for (const f of js) {
      const text = readFileSync(f, "utf8");
      expect(text, `${f}: import() de URL`).not.toMatch(/import\(\s*["'`]https?:/);
      expect(text, `${f}: importScripts remoto`).not.toMatch(/importScripts\(\s*["'`]https?:/);
    }
  });

  it("version.json (W1-13) só tem version e commit de 7 hex, sem data nem outro dado", () => {
    const v = JSON.parse(readFileSync(join(DIST, "version.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(["commit", "version"]);
    expect(v["commit"]).toMatch(/^([0-9a-f]{7}|dev)$/);
    if (process.env["GITHUB_SHA"]) expect(v["commit"]).toBe(process.env["GITHUB_SHA"].slice(0, 7).toLowerCase());
  });

  it("_headers foi copiado para dist/ e é idêntico a public/_headers", () => {
    expect(readFileSync(join(DIST, "_headers"), "utf8")).toBe(readFileSync("public/_headers", "utf8"));
  });
});
