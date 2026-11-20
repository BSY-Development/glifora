// i18n em execução (W1-06): o que o src/i18n faz com marcadores e plural de verdade, incluindo entradas hostis.
import { describe, expect, it } from "vitest";
import { render, translate } from "../../src/i18n";

describe("render: entradas hostis", () => {
  // Regressão W1-05: params[name] lia a cadeia de protótipos; "{constructor}" virava o código-fonte de Object (corrigido com Object.hasOwn).
  it("marcador com nome herdado de Object não vaza código nem '[object Object]'", () => {
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const out = render("en", `x {${name}} y`, { n: 1 });
      expect(out, name).toBe(`x {${name}} y`);
    }
  });

  it("valor com HTML, '$&' e '{n}' entra como texto, sem reinterpretar", () => {
    expect(render("en", "{a}", { a: "<img src=x onerror=1>" })).toBe("<img src=x onerror=1>");
    expect(render("en", "{a}", { a: "$&$1{b}" })).toBe("$&$1{b}");
    expect(render("en", "{a} {b}", { a: "{b}", b: "ok" })).toBe("{b} ok");
  });

  it("n inválido (NaN, Infinity, texto) cai em 'other' sem lançar", () => {
    const forms = { one: "{n} one", other: "{n} other" };
    expect(() => render("en", forms, { n: Number.NaN })).not.toThrow();
    expect(() => render("en", forms, { n: Number.POSITIVE_INFINITY })).not.toThrow();
    expect(render("en", forms, { n: "abc" })).toBe("{n} other".replace("{n}", "abc"));
  });
});

describe("translate", () => {
  it("chaves existentes devolvem texto no idioma pedido", () => {
    expect(translate("pt-BR", "app.tagline")).toMatch(/Aprenda/);
    expect(translate("en", "app.tagline")).toMatch(/Learn/);
  });
});
