// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { openDb } from "../data";
import { initLocale, t } from "../i18n";
import { profileRepo } from "../data";
import { setStorageForTest } from "../services/storage";
import { routes } from "./routes";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  localStorage.clear();
  initLocale(["en"]);
});

afterEach(() => {
  cleanup();
  setStorageForTest(null);
});

describe("rotas", () => {
  it("rota desconhecida cai no 404", async () => {
    renderAt("/isto-nao-existe");
    expect(await screen.findByRole("heading", { level: 1, name: t("notfound.title") })).toBeTruthy();
    expect(screen.getByRole("link", { name: t("notfound.home") }).getAttribute("href")).toBe("/");
  });

  it("o 404 vale também para caminho fundo, e a navegação continua à mão", async () => {
    renderAt("/place/bakery/algo/mais");
    expect(await screen.findByRole("heading", { level: 1, name: t("notfound.title") })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeTruthy();
  });

  it.each([
    ["/", "home.title"],
    ["/welcome", "welcome.title"],
    ["/place/bakery", "place.title"],
    ["/profile", "profile.title"],
    ["/settings", "settings.title"],
    ["/about", "about.title"],
  ] as const)("%s abre com o título da tela", async (path, key) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: t(key) })).toBeTruthy();
    expect(document.title).toContain(t(key));
  });

  it("/about mostra versão e commit do build", async () => {
    renderAt("/about");
    await screen.findByRole("heading", { level: 1, name: t("about.title") });
    expect(screen.getByText(t("about.version", { version: "0.0.0-test" }))).toBeTruthy();
    expect(screen.getByText(t("about.commit", { commit: "testing" }))).toBeTruthy();
  });

  it("trocar de rota move o foco para o título da tela nova e marca o item atual da navegação", async () => {
    renderAt("/");
    await screen.findByRole("heading", { level: 1, name: t("home.title") });
    fireEvent.click(screen.getByRole("link", { name: t("nav.profile") }));
    const title = await screen.findByRole("heading", { level: 1, name: t("profile.title") });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.getByRole("link", { name: t("nav.profile") }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: t("nav.home") }).getAttribute("aria-current")).toBeNull();
  });

  it("o idioma troca a tela na hora, pelo seletor sempre presente", async () => {
    renderAt("/about");
    await screen.findByRole("heading", { level: 1, name: "About Glifora" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pt-BR" } });
    expect(await screen.findByRole("heading", { level: 1, name: "Sobre o Glifora" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("pt-BR");
  });
});

describe("apagar os dados deste aparelho", () => {
  it("pede confirmação própria e cancelar não apaga nada", async () => {
    const db = await openDb("glifora-ui-test");
    setStorageForTest(db);
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1 }, { now: () => 1, uuid: () => "x" });
    renderAt("/settings");

    fireEvent.click(await screen.findByRole("button", { name: t("data.wipe.button") }));
    expect(screen.getByText(t("data.wipe.confirm_title"))).toBeTruthy();
    expect(await db.docs.count()).toBe(1); // só perguntou

    // O jsdom não implementa showModal(): o <dialog> fica "fechado" para a árvore de acessibilidade, daí o hidden.
    fireEvent.click(screen.getByRole("button", { name: t("data.wipe.cancel"), hidden: true }));
    await waitFor(() => expect(screen.queryByText(t("data.wipe.confirm_title"))).toBeNull());
    expect(await db.docs.count()).toBe(1);
    db.close();
    await db.delete();
  });
});
