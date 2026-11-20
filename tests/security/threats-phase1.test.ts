// W1-14 — ameaças de W0-03 §1.2 C, no que a fase 1 já alcança. Dono: Revisor.
// Cada bloco diz qual linha da tabela C ele cobre. O que depende de fase futura (key, Supabase, provedores) está
// marcado "FASE n" e vira teste quando a fase chegar (lista em docs/PLAN.md, notas da W1-14).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
function walk(dir: string, keep: (f: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p, keep) : keep(p) ? [p] : [];
  });
}
const norm = (p: string) => p.replaceAll("\\", "/");

/** Código de produção de src/ (sem testes). */
const SRC = walk("src", (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith(".d.ts")).map(norm);
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"); // sem comentários

describe("C1 · dependência npm comprometida", () => {
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; license: string };

  it("dependências de runtime são exatamente as aprovadas (D-41); uma nova exige o Arquiteto e mexer aqui", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["dexie", "dexie-react-hooks", "react", "react-dom", "react-router", "zod"]);
  });

  it("versões exatas (sem ^ ou ~), runtime e desenvolvimento", () => {
    for (const [name, v] of [...Object.entries(pkg.dependencies), ...Object.entries(pkg.devDependencies)]) expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it(".npmrc: ignore-scripts, save-exact e engine-strict", () => {
    const npmrc = read(".npmrc");
    expect(npmrc).toMatch(/^ignore-scripts=true$/m);
    expect(npmrc).toMatch(/^save-exact=true$/m);
    expect(npmrc).toMatch(/^engine-strict=true$/m);
  });

  it("package-lock: todo pacote vem do registro oficial, com integridade; nada de git, http ou arquivo", () => {
    const lock = JSON.parse(read("package-lock.json")) as { packages: Record<string, { resolved?: string; integrity?: string; link?: boolean }> };
    const bad: string[] = [];
    for (const [name, p] of Object.entries(lock.packages)) {
      if (name === "" || p.link) continue;
      if (!p.resolved?.startsWith("https://registry.npmjs.org/")) bad.push(`${name}: resolved=${p.resolved}`);
      if (!p.integrity) bad.push(`${name}: sem integrity`);
    }
    expect(bad).toEqual([]);
  });

  it("nenhum script de ciclo de vida (preinstall/postinstall/prepare) no package.json do projeto", () => {
    const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
    for (const hook of ["preinstall", "install", "postinstall", "prepare", "prepublish"]) expect(scripts[hook], hook).toBeUndefined();
  });

  it("Dependabot cobre npm e github-actions", () => {
    const d = read(".github/dependabot.yml");
    expect(d).toMatch(/package-ecosystem:\s*["']?npm/);
    expect(d).toMatch(/package-ecosystem:\s*["']?github-actions/);
  });
});

describe("C2 · XSS por conteúdo colado, importado ou digitado (HTML nunca vem de dado)", () => {
  it("nenhum caminho de HTML dinâmico em src/ (innerHTML, dangerouslySetInnerHTML, document.write, eval, new Function, setTimeout de string)", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const code = strip(read(f));
      for (const re of [/dangerouslySetInnerHTML/, /\.(inner|outer)HTML\b/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new\s+Function\s*\(/, /set(Timeout|Interval)\s*\(\s*["'`]/, /setHTMLUnsafe|parseHTMLUnsafe/, /createContextualFragment/, /DOMParser/, /srcdoc/i]) {
        if (re.test(code)) bad.push(`${f}: ${re}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("Trusted Types: a única política criada é glifora-sw, em sw-register.ts", () => {
    const users = SRC.filter((f) => /createPolicy\s*\(/.test(strip(read(f))));
    expect(users).toEqual(["src/sw-register.ts"]);
    expect(read("src/sw-register.ts")).toMatch(/createPolicy\(\s*["']glifora-sw["']/);
  });

  it("nenhum campo de dado vira URL, href, src ou atributo: href/src/to só recebem literal, constante fixa ou id de enum", () => {
    const bad: string[] = [];
    for (const f of SRC.filter((x) => x.endsWith(".tsx"))) {
      const code = strip(read(f));
      for (const m of code.matchAll(/\b(href|src|action|formAction|srcSet|data|poster)=\{(`[^`]*`|[^}]*)\}/g)) {
        const expr = (m[2] ?? "").trim();
        const okFixed = /^[A-Z][A-Z0-9_]+$/.test(expr); // constante em MAIÚSCULAS (ex.: SOURCE_URL)
        const okPlace = /^`\/place\/\$\{location\.id\}`$/.test(expr); // id do catálogo, enum LocationId
        if (!okFixed && !okPlace) bad.push(`${f}: ${m[1]}={${expr}}`);
      }
      // `to=` do React Router: só literal ou o id do catálogo
      for (const m of code.matchAll(/\bto=\{(`[^`]*`|[^}]*)\}/g)) {
        const expr = (m[1] ?? "").trim();
        if (!/^`\/place\/\$\{location\.id\}`$/.test(expr) && !/^item\.to$/.test(expr)) bad.push(`${f}: to={${expr}}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("links externos: só o código-fonte, com rel noopener noreferrer, e nada de target=_blank sem rel", () => {
    const external: string[] = [];
    for (const f of SRC) {
      const code = strip(read(f));
      for (const m of code.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) external.push(`${f}: ${m[1]}`);
      for (const m of code.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/g)) expect(m[0], f).toMatch(/rel=["'][^"']*noopener[^"']*["']/);
    }
    expect(external).toEqual(["src/ui/screens/About.tsx: https://github.com/BSY-Development/glifora"]);
    expect(read("src/ui/screens/About.tsx")).toMatch(/<a href=\{SOURCE_URL\} rel="noopener noreferrer">/);
  });

  it("o apelido é texto puro: o schema recusa < > controle e bidi, e a tela só o põe como texto de JSX", () => {
    const schema = read("src/data/schema/docs.ts");
    expect(schema).toMatch(/Nickname/);
    expect(schema).toMatch(/[<>]/); // a regra de caracteres proibidos existe
    for (const f of ["src/ui/screens/Home.tsx", "src/ui/screens/Profile.tsx", "src/ui/NicknameField.tsx", "src/ui/screens/Welcome.tsx"]) {
      expect(strip(read(f)), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML|\.outerHTML/);
    }
  });
});

describe("C3 · vazamento: nada sai do aparelho na fase 1", () => {
  it("rede só em src/data e src/ai (o lint já exige; aqui conferimos sem o lint): fetch, XHR, beacon, WebSocket, EventSource, import() remoto", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const code = strip(read(f));
      for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /\bWebSocket\b/, /\bEventSource\b/, /importScripts/, /new\s+(Shared)?Worker\b/, /import\(\s*["'`]https?:/, /window\.open\s*\(/, /\bnavigator\.share\b/]) {
        if (re.test(code)) bad.push(`${f}: ${re}`);
      }
    }
    expect(bad).toEqual([]); // FASE 5/6: o primeiro fetch legítimo nascerá em src/ai/ ou src/data/ e este teste ganha a exceção por arquivo
  });

  it("a navegação de topo só acontece para a própria origem (location.replace('/') ao apagar; nenhum location.href = dado)", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const code = strip(read(f));
      for (const m of code.matchAll(/(?:window\.)?location\.(?:href\s*=|assign\(|replace\()\s*([^;)\n]*)/g)) {
        if (!/^["']\/["']$/.test((m[1] ?? "").trim())) bad.push(`${f}: location.${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("nenhum nome de key, token ou credencial no código da fase 1 (FASE 6: este teste muda quando o adaptador entrar)", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const code = strip(read(f));
      if (/api[_-]?key|apikey|bearer|authorization|x-api-key|secret|password|senha/i.test(code)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  it("nenhuma origem externa no connect-src e nenhum host de análise ou CDN em arquivos de configuração e HTML", () => {
    const files = ["index.html", "public/_headers", "vite.config.ts", "package.json"];
    for (const f of files) expect(read(f), f).not.toMatch(/google-analytics|googletagmanager|gtag|segment\.|hotjar|sentry|plausible|cloudflareinsights|beacon\.min\.js|fonts\.googleapis|fonts\.gstatic|unpkg|jsdelivr|cdnjs/i);
  });

  it("localStorage: só a chave STORAGE_KEY, que começa com glifora.; o apagar-tudo remove todo o prefixo glifora.", () => {
    const args: string[] = [];
    for (const f of SRC) for (const m of strip(read(f)).matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)) args.push(`${f}: ${(m[1] ?? "").trim()}`);
    expect(args.length).toBeGreaterThan(0);
    for (const a of args) expect(a, "só a constante").toMatch(/: STORAGE_KEY$|: key$/);
    expect(read("src/i18n/index.ts")).toMatch(/STORAGE_KEY\s*=\s*["']glifora\./);
    expect(read("src/services/transfer.ts")).toMatch(/startsWith\(["']glifora\.["']\)/);
  });
});

describe("C3b · exportação: só docs, sem meta, sem key", () => {
  const code = strip(read("src/data/transfer.ts"));
  it("buildExport lê só `docs` e monta cada linha com exatamente id, v, data, updatedAt, deleted", () => {
    const build = code.slice(code.indexOf("export async function buildExport"), code.indexOf("export function serializeExport"));
    expect(build).toMatch(/db\.docs\.toArray\(\)/);
    expect(build).not.toMatch(/db\.meta\.(toArray|get|each)/);
    expect(build).not.toMatch(/localStorage|sessionStorage|session\b/);
    expect(build).toMatch(/\{ id, v, data, updatedAt, deleted \}/);
    expect(build).not.toMatch(/dirty/);
  });
  it("o schema do arquivo é estrito (campo desconhecido, como `apiKey`, é recusado) e a versão 1 não tem campo de key", () => {
    expect(code).toMatch(/z\.strictObject\(\{\s*format/);
    expect(code).not.toMatch(/apiKey|api_key|token|secret|password|authorization/i);
  });
});

describe("C3c · service worker: só o próprio site, só o precache", () => {
  it("vite.config.ts: runtimeCaching vazio, sem importScripts, version.json fora do precache, registro manual", () => {
    // Só comentários de linha: um "/*" dentro de um glob ("**/*.js") enganaria um removedor de comentários de bloco.
    const cfg = read("vite.config.ts")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,\s*\/\/.*$/gm, ",");
    expect(cfg).toMatch(/runtimeCaching:\s*\[\s*\]/);
    expect(cfg).toMatch(/inlineWorkboxRuntime:\s*true/);
    expect(cfg).toMatch(/injectRegister:\s*false/);
    expect(cfg).toMatch(/globIgnores:\s*\[[^\]]*version\.json/);
    expect(cfg).not.toMatch(/additionalManifestEntries|importScripts|offlineGoogleAnalytics/);
  });

  const has = existsSync("dist/sw.js");
  if (!has && process.env["REQUIRE_DIST"]) throw new Error("REQUIRE_DIST=1 mas dist/sw.js não existe");
  it.skipIf(!has)("dist/sw.js: sem importScripts, sem origem externa; precache só com arquivos que existem em dist/ e caminho relativo", () => {
    const sw = read("dist/sw.js");
    expect(sw).not.toMatch(/importScripts/);
    expect(sw).not.toMatch(/\bfetch\(\s*["'`]https?:/);
    const urls = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) {
      expect(u, "caminho do precache").not.toMatch(/^(https?:)?\/\//);
      expect(existsSync(join("dist", u)), `${u} existe em dist/`).toBe(true);
    }
    expect(urls.some((u) => u.includes("version.json"))).toBe(false);
    expect(urls.some((u) => u === "_headers" || u.endsWith(".map"))).toBe(false);
    // O worker só ouve install, activate, fetch (do Workbox) e message (SKIP_WAITING); nada de push, sync, notification.
    const events = new Set([...sw.matchAll(/addEventListener\("([a-z]+)"/g)].map((m) => m[1]));
    expect([...events].sort()).toEqual(["activate", "fetch", "install", "message"]);
    // A única URL no texto é o aviso do Workbox (já em KNOWN_URLS do csp-build).
    const text = [...sw.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => m[0]);
    expect(text.every((u) => /bit\.ly\/wb-precache/.test(u))).toBe(true);
  });
});

describe("D-45 · licenças coerentes", () => {
  it("package.json AGPL-3.0-only; LICENSE (AGPL v3) e content/LICENSE (CC BY-SA 4.0) existem; CREDITS não diz MIT", () => {
    expect((JSON.parse(read("package.json")) as { license: string }).license).toBe("AGPL-3.0-only");
    expect(read("LICENSE")).toMatch(/GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/);
    expect(read("content/LICENSE")).toMatch(/Attribution-ShareAlike 4\.0/);
    expect(read("public/assets/CREDITS.md")).toMatch(/AGPL-3\.0/);
    expect(read("public/assets/CREDITS.md")).not.toMatch(/\bMIT\b/);
  });
  it("README e /about dizem a mesma coisa (AGPL-3.0 no código, CC BY-SA 4.0 no conteúdo) nos dois idiomas", () => {
    expect(read("README.md")).toMatch(/AGPL-3\.0/);
    expect(read("README.md")).toMatch(/CC BY-SA 4\.0/);
    for (const lang of ["en", "pt-BR"]) {
      const j = JSON.parse(read(`i18n/${lang}.json`)) as Record<string, string>;
      expect(j["about.license.code"], lang).toMatch(/AGPL-3\.0/);
      expect(j["about.license.content"], lang).toMatch(/CC BY-SA 4\.0/);
      expect(j["about.source"], lang).toBeTruthy();
    }
  });
  it("a seção 13 da AGPL: /about oferece o código-fonte com o commit publicado", () => {
    const about = read("src/ui/screens/About.tsx");
    expect(about).toMatch(/getAppInfo/);
    expect(about).toMatch(/about\.source/);
  });
});
