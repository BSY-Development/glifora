import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, detectLocale, getLocale, initLocale, render, setLocale, subscribe, t, translate } from "./index";

describe("detectLocale", () => {
  it("pt, pt-PT e pt-BR → pt-BR", () => {
    expect(detectLocale(["pt"])).toBe("pt-BR");
    expect(detectLocale(["pt-PT"])).toBe("pt-BR");
    expect(detectLocale(["pt-BR", "en"])).toBe("pt-BR");
  });

  it("en e variantes → en; outros idiomas → en", () => {
    expect(detectLocale(["en-GB"])).toBe("en");
    expect(detectLocale(["fr"])).toBe("en");
    expect(detectLocale(["fr-FR", "de"])).toBe("en");
  });

  it("pula idioma sem tradução e usa o próximo que a interface tem", () => {
    expect(detectLocale(["fr-FR", "pt-BR"])).toBe("pt-BR");
  });

  it("lista vazia e maiúsculas", () => {
    expect(detectLocale([])).toBe("en");
    expect(detectLocale(["PT-br"])).toBe("pt-BR");
  });
});

describe("render: interpolação", () => {
  it("troca {n} e outros marcadores; formata número no idioma", () => {
    expect(render("en", "{n} XP para {name}", { n: 1200, name: "Ana" })).toBe("1,200 XP para Ana");
    expect(render("pt-BR", "{n} XP", { n: 1200 })).toBe("1.200 XP");
  });

  it("marcador sem valor fica como está; sem params devolve o texto", () => {
    expect(render("en", "Oi {nome}", {})).toBe("Oi {nome}");
    expect(render("en", "Oi {nome}")).toBe("Oi {nome}");
  });

  it("não interpreta HTML nem '$' do valor", () => {
    expect(render("en", "{x}", { x: "<b>$&</b>" })).toBe("<b>$&</b>");
  });
});

describe("render: plural", () => {
  const forms = { one: "{n} dia", other: "{n} dias" };

  it("pt-BR: 0 e 1 são 'one'; 2 é 'other'", () => {
    expect(render("pt-BR", forms, { n: 0 })).toBe("0 dia");
    expect(render("pt-BR", forms, { n: 1 })).toBe("1 dia");
    expect(render("pt-BR", forms, { n: 2 })).toBe("2 dias");
  });

  it("en: 0 é 'other'; 1 é 'one'", () => {
    expect(render("en", { one: "{n} day", other: "{n} days" }, { n: 0 })).toBe("0 days");
    expect(render("en", { one: "{n} day", other: "{n} days" }, { n: 1 })).toBe("1 day");
  });

  it("cai em 'other' quando a categoria falta ou n não vem", () => {
    expect(render("en", { other: "{n} things" }, { n: 1 })).toBe("1 things");
    expect(render("en", forms)).toBe("{n} dias");
  });
});

describe("idioma atual", () => {
  const store = new Map<string, string>();
  const doc = { documentElement: { lang: "" } };

  beforeEach(() => {
    store.clear();
    doc.documentElement.lang = "";
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("document", doc);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("initLocale detecta, atualiza <html lang> e não grava", () => {
    expect(initLocale(["pt-PT"])).toBe("pt-BR");
    expect(doc.documentElement.lang).toBe("pt-BR");
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("initLocale prefere o idioma salvo; valor inválido é ignorado", () => {
    store.set(STORAGE_KEY, "en");
    expect(initLocale(["pt-BR"])).toBe("en");
    store.set(STORAGE_KEY, "klingon");
    expect(initLocale(["pt-BR"])).toBe("pt-BR");
  });

  it("setLocale muda t() na hora, persiste, atualiza <html lang> e avisa quem assinou", () => {
    initLocale(["en"]);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setLocale("pt-BR");
    expect(getLocale()).toBe("pt-BR");
    expect(t("app.tagline")).toBe(translate("pt-BR", "app.tagline"));
    expect(t("app.tagline")).toMatch(/Aprenda/);
    expect(store.get(STORAGE_KEY)).toBe("pt-BR");
    expect(doc.documentElement.lang).toBe("pt-BR");
    expect(listener).toHaveBeenCalledTimes(1);
    setLocale("pt-BR"); // sem mudança: não avisa
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLocale("en");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("localStorage que lança não derruba", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(initLocale(["fr"])).toBe("en");
    expect(() => setLocale("pt-BR")).not.toThrow();
    expect(getLocale()).toBe("pt-BR");
  });
});

describe("translate: nunca sobra '{marcador}' (D-55)", () => {
  it("em dev e em teste, o parâmetro que falta lança, com a chave no erro", () => {
    expect(() => translate("pt-BR", "report.level", { n: 2 })).toThrow(/\{title\}.*report\.level/);
    expect(() => translate("pt-BR", "report.level")).toThrow(/\{n\}/);
    expect(() => translate("en", "report.levelup.title", {})).toThrow(/\{title\}/);
  });

  it("com todos os parâmetros, nada sobra", () => {
    expect(translate("pt-BR", "report.level", { n: 2, title: "Viajante" })).toBe("Nível 2 · Viajante");
    expect(translate("en", "report.next.again.2.hint", { base: "English", target: "Portuguese" })).not.toMatch(/[{}]/);
  });

  it("um valor que contém chaves entra como texto (só o modelo é conferido)", () => {
    expect(translate("en", "report.level", { n: 1, title: "{x}" })).toBe("Level 1 · {x}");
  });

  it("render sem strict continua devolvendo o marcador (usado nos testes de entrada hostil)", () => {
    expect(render("en", "x {a} y", {})).toBe("x {a} y");
  });
});
