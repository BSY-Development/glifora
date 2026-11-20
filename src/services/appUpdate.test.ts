// @vitest-environment jsdom
// W2-10: a regra da atualização automática na abertura (D-46): quando ativa sozinha e quando só avisa.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_UPDATE_WINDOW_MS, canAutoUpdate, hasUpdate, holdUpdates, onUpdateReady } from "./appUpdate";

const ok = { sinceOpenMs: 1200, pathname: "/", holds: 0 };

describe("canAutoUpdate", () => {
  it("sim: na vila, dentro da janela e sem trava", () => {
    expect(canAutoUpdate(ok)).toBe(true);
    expect(canAutoUpdate({ ...ok, sinceOpenMs: AUTO_UPDATE_WINDOW_MS })).toBe(true);
  });

  it("não: passou da janela", () => {
    expect(canAutoUpdate({ ...ok, sinceOpenMs: AUTO_UPDATE_WINDOW_MS + 1 })).toBe(false);
  });

  it("não: fora da vila (missão, perfil, ajustes, formulário)", () => {
    for (const pathname of ["/place/bakery", "/profile", "/settings", "/settings/voice", "/welcome", "/mission/bakery-01", "/about"]) {
      expect(canAutoUpdate({ ...ok, pathname }), pathname).toBe(false);
    }
  });

  it("não: com trava ativa (importação, missão em andamento)", () => {
    expect(canAutoUpdate({ ...ok, holds: 1 })).toBe(false);
  });
});

describe("onUpdateReady", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ativa sozinha quando a regra deixa, sem mostrar o aviso", () => {
    const activate = vi.fn();
    const before = hasUpdate();
    onUpdateReady(activate, ok);
    expect(activate).toHaveBeenCalledOnce();
    expect(hasUpdate()).toBe(before);
  });

  it("não ativa e passa a oferecer o botão quando a regra não deixa", () => {
    const activate = vi.fn();
    onUpdateReady(activate, { ...ok, pathname: "/place/bakery" });
    expect(activate).not.toHaveBeenCalled();
    expect(hasUpdate()).toBe(true);
  });
});

describe("holdUpdates", () => {
  it("segura enquanto houver trava e solta só uma vez por trava", () => {
    const activate = vi.fn();
    const release = holdUpdates();
    const other = holdUpdates();
    onUpdateReady(activate); // o caminho padrão lê as travas reais (jsdom: pathname "/", recém aberto)
    expect(activate).not.toHaveBeenCalled();
    expect(hasUpdate()).toBe(true);
    release();
    release(); // soltar de novo não solta a trava dos outros
    const third = vi.fn();
    onUpdateReady(third, { sinceOpenMs: 100, pathname: "/", holds: 1 });
    expect(third).not.toHaveBeenCalled();
    other();
  });
});
