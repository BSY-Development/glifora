// CSP — arquivo (W0-03 §7 e §2.8): compara public/_headers, diretiva por diretiva, com a lista esperada AQUI.
// Mudar a CSP obriga a mudar este teste, e o Revisor vê. `connect-src` cresce por fase (§2.8): edite EXPECTED_CONNECT.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHeadersFile } from "../../config/headers";

const blocks = parseHeadersFile(readFileSync("public/_headers", "utf8"));
const all = blocks["/*"] ?? {};
const csp = all["Content-Security-Policy"] ?? "";

/** Fase 1: nada além de 'self'. Fase 5 acrescenta o host exato do Supabase; fase 6, as APIs dos provedores (com caminho). */
const EXPECTED_CONNECT = ["'self'"];

const EXPECTED: Record<string, string[]> = {
  "default-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "img-src": ["'self'"],
  "font-src": ["'self'"],
  "media-src": ["'self'"],
  "connect-src": EXPECTED_CONNECT,
  "manifest-src": ["'self'"],
  "worker-src": ["'self'"],
  "frame-src": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "frame-ancestors": ["'none'"],
  "require-trusted-types-for": ["'script'"],
  "trusted-types": ["glifora-sw"],
  "upgrade-insecure-requests": [],
};

function directives(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of policy.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (!name) continue;
    expect(out[name], `diretiva repetida: ${name}`).toBeUndefined();
    out[name] = values;
  }
  return out;
}

describe("CSP — arquivo", () => {
  const parsed = directives(csp);

  it("tem exatamente as diretivas esperadas, com os valores esperados", () => {
    expect(parsed).toEqual(EXPECTED);
  });

  it("nenhum valor perigoso em nenhuma diretiva", () => {
    for (const [name, values] of Object.entries(parsed)) {
      for (const v of values) {
        expect(v, name).not.toMatch(/^'unsafe-(inline|eval|hashes)'$/);
        expect(v, name).not.toBe("*");
        expect(v, name).not.toMatch(/^(data|blob|filesystem|http|ws|mediastream):$/);
        expect(v, name).not.toMatch(/^http:/i);
        expect(v, name).not.toMatch(/^\*\.|\/\/\*\./); // curinga de host (ex.: *.supabase.co)
        expect(v, name).not.toMatch(/^'nonce-|^'strict-dynamic'$/);
      }
    }
  });

  it("origens externas do connect-src só com https e sem curinga", () => {
    for (const v of parsed["connect-src"] ?? []) {
      if (v.startsWith("'")) continue;
      expect(v, "connect-src").toMatch(/^https:\/\/[a-z0-9.-]+(\/\S*)?$/);
      expect(v, "connect-src").not.toContain("*");
    }
  });

  it("não há CSP em <meta> no index.html", () => {
    expect(readFileSync("index.html", "utf8")).not.toMatch(/http-equiv\s*=\s*["']?content-security-policy/i);
  });
});

describe("outros cabeçalhos de segurança", () => {
  it("valores esperados no bloco /*", () => {
    expect(all["X-Content-Type-Options"]).toBe("nosniff");
    expect(all["X-Frame-Options"]).toBe("DENY");
    expect(all["Referrer-Policy"]).toBe("no-referrer");
    expect(all["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(all["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(all["Strict-Transport-Security"]).toMatch(/^max-age=\d{7,}/);
  });

  it("Permissions-Policy: só o microfone, e só para o próprio site", () => {
    const pp = all["Permissions-Policy"] ?? "";
    expect(pp).toContain("microphone=(self)");
    for (const feature of ["camera", "geolocation", "payment", "usb", "midi", "display-capture"]) expect(pp).toContain(`${feature}=()`);
    expect(pp).not.toContain("*");
  });

  it("cache: ativos com hash são imutáveis; sw.js nunca fica em cache", () => {
    expect(blocks["/assets/*"]?.["Cache-Control"]).toBe("public, max-age=31536000, immutable");
    expect(blocks["/sw.js"]?.["Cache-Control"]).toBe("no-cache");
    expect(blocks["/version.json"]?.["Cache-Control"]).toBe("no-cache"); // W1-13: a conferência do deploy lê este arquivo
  });

  it("blocos extras só mudam cache: nada de CSP ou outro cabeçalho de segurança fora do /*", () => {
    expect(Object.keys(blocks).sort()).toEqual(["/*", "/assets/*", "/sw.js", "/version.json"]);
    for (const [path, headers] of Object.entries(blocks)) {
      if (path !== "/*") expect(Object.keys(headers), path).toEqual(["Cache-Control"]);
    }
    expect(all["Cache-Control"], "Cache-Control em /* somaria com os blocos específicos").toBeUndefined();
  });
});
