import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHeadersFile, previewHeaders } from "./headers";

describe("parseHeadersFile", () => {
  it("separa os blocos por rota e guarda nome e valor", () => {
    const blocks = parseHeadersFile("/*\n  X-A: um\n  X-B: dois: com dois-pontos\n\n/assets/*\n  Cache-Control: public, immutable\n");
    expect(blocks).toEqual({
      "/*": { "X-A": "um", "X-B": "dois: com dois-pontos" },
      "/assets/*": { "Cache-Control": "public, immutable" },
    });
  });

  it("aceita CRLF, comentários e linhas em branco", () => {
    expect(parseHeadersFile("# nota\r\n/*\r\n  # outra\r\n  X-A: 1\r\n\r\n")).toEqual({ "/*": { "X-A": "1" } });
  });

  it("junta com vírgula o cabeçalho repetido no mesmo bloco", () => {
    expect(parseHeadersFile("/*\n  Link: a\n  Link: b\n")["/*"]).toEqual({ Link: "a, b" });
  });

  it("recusa cabeçalho sem rota e linha sem dois-pontos", () => {
    expect(() => parseHeadersFile("  X-A: 1\n")).toThrow(/sem rota/);
    expect(() => parseHeadersFile("/*\n  sem-dois-pontos\n")).toThrow(/sem ":"/);
  });
});

describe("previewHeaders", () => {
  it("devolve o bloco /*", () => {
    expect(previewHeaders("/x\n  A: 1\n/*\n  B: 2\n")).toEqual({ B: "2" });
  });

  it("falha se não há bloco /*", () => {
    expect(() => previewHeaders("/x\n  A: 1\n")).toThrow(/"\/\*"/);
  });

  it("lê o public/_headers de verdade: CSP completa e cache dos ativos", () => {
    const text = readFileSync("public/_headers", "utf8");
    const all = previewHeaders(text);
    expect(all["Content-Security-Policy"]).toContain("connect-src 'self' https://generativelanguage.googleapis.com/v1beta/models/;");
    expect(all["Content-Security-Policy"]).toContain("trusted-types glifora-sw");
    expect(Object.keys(all)).toContain("Strict-Transport-Security");
    expect(parseHeadersFile(text)["/assets/*"]?.["Cache-Control"]).toBe("public, max-age=31536000, immutable");
  });
});

describe("detachedHeaders (D-46)", () => {
  it("lê as linhas '! Nome' do bloco pedido e o parser não as trata como cabeçalho", async () => {
    const { detachedHeaders, parseHeadersFile } = await import("./headers");
    const text = "/*\n  X-A: 1\n  ! Report-To\n  !NEL\n\n/assets/*\n  ! Outro\n";
    expect(detachedHeaders(text)).toEqual(["report-to", "nel"]);
    expect(detachedHeaders(text, "/assets/*")).toEqual(["outro"]);
    expect(parseHeadersFile(text)["/*"]).toEqual({ "X-A": "1" });
  });
});
