// @vitest-environment jsdom
// W1-10 e W1-11: primeira visita, perfil, ajustes, mapa da vila e a tela do local.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { appendEvent, avatarRepo, openDb, prefsRepo, profileRepo, type GliforaDb } from "../data";
import { initLocale, t } from "../i18n";
import { setStorageForTest } from "../services/storage";
import { applyDisplayPrefs } from "./display";
import { routes } from "./routes";

const deps = { now: () => 1, uuid: () => "x" };
let db: GliforaDb;

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

async function withProfile(nickname = "Ana") {
  await profileRepo.save(db, { nickname, createdAt: 1 }, deps);
}

beforeEach(async () => {
  localStorage.clear();
  initLocale(["en"]);
  delete document.documentElement.dataset["textSize"];
  delete document.documentElement.dataset["motion"];
  db = await openDb("glifora-screens-test");
  setStorageForTest(db);
});

afterEach(async () => {
  cleanup();
  setStorageForTest(null);
  db.close();
  await db.delete();
});

describe("primeira visita", () => {
  it("sem perfil, / leva a /welcome; concluir cria o perfil e leva à vila, e /welcome nunca mais aparece", async () => {
    const router = renderAt("/");
    await screen.findByRole("heading", { level: 1, name: t("welcome.title") });
    expect(router.state.location.pathname).toBe("/welcome");

    fireEvent.change(await screen.findByLabelText(t("welcome.nickname")), { target: { value: "  Bia  " } });
    fireEvent.click(screen.getByRole("button", { name: t("welcome.start") }));

    await screen.findByRole("heading", { level: 1, name: t("home.title") });
    expect(router.state.location.pathname).toBe("/");
    expect((await profileRepo.get(db))?.nickname).toBe("Bia");
    expect(await screen.findByText(t("home.greeting", { name: "Bia" }))).toBeTruthy();

    await router.navigate("/welcome");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await screen.findByRole("heading", { level: 1, name: t("home.title") })).toBeTruthy();
  });

  it("o apelido é opcional: começar sem nada também cria o perfil", async () => {
    renderAt("/welcome");
    fireEvent.click(await screen.findByRole("button", { name: t("welcome.start") }));
    await screen.findByRole("heading", { level: 1, name: t("home.title") });
    expect((await profileRepo.get(db))?.nickname).toBe("");
    expect(await screen.findByText(t("home.greeting_anon"))).toBeTruthy();
  });

  it("apelido com HTML ou grande demais é recusado e nada é gravado", async () => {
    renderAt("/welcome");
    const input = await screen.findByLabelText(t("welcome.nickname"));
    fireEvent.change(input, { target: { value: "<b>oi</b>" } });
    fireEvent.click(screen.getByRole("button", { name: t("welcome.start") }));
    expect((await screen.findByRole("alert")).textContent).toBe(t("nickname.error.chars"));

    fireEvent.change(input, { target: { value: "x".repeat(31) } });
    fireEvent.click(screen.getByRole("button", { name: t("welcome.start") }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(t("nickname.error.long", { max: 30 })));
    expect(await profileRepo.get(db)).toBeNull();
  });

  it("trocar o idioma na primeira tela muda o texto na hora", async () => {
    renderAt("/welcome");
    await screen.findByRole("heading", { level: 1, name: "Welcome to Glifora" });
    fireEvent.click(await screen.findByRole("radio", { name: "Português (Brasil)" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Boas-vindas ao Glifora" })).toBeTruthy();
  });
});

describe("perfil", () => {
  it("salvar o apelido grava no banco e some com o aviso ao editar de novo", async () => {
    await withProfile("Ana");
    renderAt("/profile");
    const input = await screen.findByLabelText(t("profile.nickname"));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("Ana"));

    fireEvent.change(input, { target: { value: "Ana Clara" } });
    fireEvent.click(screen.getByRole("button", { name: t("profile.save") }));
    const saved = await screen.findByText(t("profile.saved"));
    // o aviso fica no formulário do apelido, depois do botão (e não no fim da tela)
    const form = input.closest("form") as HTMLFormElement;
    expect(form.contains(saved)).toBe(true);
    const button = screen.getByRole("button", { name: t("profile.save") });
    expect(button.compareDocumentPosition(saved) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await profileRepo.get(db)).toEqual({ nickname: "Ana Clara", createdAt: 1 });

    fireEvent.change(input, { target: { value: "Ana C." } });
    expect(screen.queryByText(t("profile.saved"))).toBeNull();
  });

  it("apelido com < ou > não é salvo", async () => {
    await withProfile("Ana");
    renderAt("/profile");
    const input = await screen.findByLabelText(t("profile.nickname"));
    fireEvent.change(input, { target: { value: "a<b" } });
    fireEvent.click(screen.getByRole("button", { name: t("profile.save") }));
    expect(await screen.findByText(t("nickname.error.chars"))).toBeTruthy();
    expect((await profileRepo.get(db))?.nickname).toBe("Ana");
  });

  it("avatar e idioma base valem na hora e persistem", async () => {
    await withProfile();
    renderAt("/profile");
    const avatars = await screen.findByRole("group", { name: t("profile.avatar") });
    expect(within(avatars).getAllByRole("radio")).toHaveLength(4);

    fireEvent.click(within(avatars).getByRole("radio", { name: t("avatar.c") }));
    await waitFor(async () => expect((await avatarRepo.get(db))?.figure).toBe("c"));
    expect((within(avatars).getByRole("radio", { name: t("avatar.c") }) as HTMLInputElement).checked).toBe(true);

    const base = screen.getByRole("group", { name: t("profile.base") });
    expect((within(base).getByRole("radio", { name: t("profile.base.same") }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(base).getByRole("radio", { name: "Português (Brasil)" }));
    await waitFor(async () => expect((await prefsRepo.get(db))?.baseLang).toBe("pt-BR"));
    fireEvent.click(within(base).getByRole("radio", { name: t("profile.base.same") }));
    await waitFor(async () => expect((await prefsRepo.get(db))?.baseLang).toBeNull());
  });

  it("o idioma da interface vem da própria tela (sem o seletor repetido da barra)", async () => {
    await withProfile();
    renderAt("/profile");
    await screen.findByRole("heading", { level: 1, name: t("profile.title") });
    expect(screen.queryByRole("combobox")).toBeNull();
    const lang = screen.getByRole("group", { name: t("lang.label") });
    fireEvent.click(within(lang).getByRole("radio", { name: "Português (Brasil)" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Seu perfil" })).toBeTruthy();
  });
});

describe("ajustes", () => {
  it("tamanho do texto e movimento persistem e passam a valer no <html>", async () => {
    await withProfile();
    renderAt("/settings");
    const size = await screen.findByRole("group", { name: t("settings.textsize") });
    fireEvent.click(within(size).getByRole("radio", { name: t("settings.textsize.xlarge") }));
    await waitFor(() => expect(document.documentElement.dataset["textSize"]).toBe("xlarge"));
    expect((await prefsRepo.get(db))?.textSize).toBe("xlarge");

    const motion = screen.getByRole("group", { name: t("settings.motion") });
    fireEvent.click(within(motion).getByRole("radio", { name: t("settings.motion.on") }));
    await waitFor(() => expect(document.documentElement.dataset["motion"]).toBe("on"));
    fireEvent.click(within(motion).getByRole("radio", { name: t("settings.motion.system") }));
    await waitFor(() => expect(document.documentElement.dataset["motion"]).toBeUndefined());
    expect((await prefsRepo.get(db))?.reduceMotion).toBe("system");
  });

  it("sons só ficam guardados", async () => {
    await withProfile();
    renderAt("/settings");
    const box = await screen.findByRole("checkbox", { name: new RegExp(t("settings.sounds")) });
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(box);
    await waitFor(async () => expect((await prefsRepo.get(db))?.sounds).toBe(false));
  });

  it("applyDisplayPrefs: 'system' não força nada, deixando o prefers-reduced-motion do aparelho valer", () => {
    const root = document.createElement("div");
    applyDisplayPrefs({ textSize: "large", reduceMotion: "off" }, root);
    expect(root.dataset["textSize"]).toBe("large");
    expect(root.dataset["motion"]).toBe("off");
    applyDisplayPrefs({ textSize: "normal", reduceMotion: "system" }, root);
    expect(root.dataset["motion"]).toBeUndefined();
  });
});

describe("a vila e os locais", () => {
  it("a padaria é um link com o nome do local e leva a /place/bakery", async () => {
    await withProfile();
    const router = renderAt("/");
    const link = await screen.findByRole("link", { name: t("place.bakery") });
    expect(link.getAttribute("href")).toBe("/place/bakery");
    fireEvent.click(link);
    await screen.findByRole("heading", { level: 1, name: t("place.bakery") });
    expect(router.state.location.pathname).toBe("/place/bakery");
    expect(screen.getByText(t("npc.tilda.name"))).toBeTruthy();
    expect(screen.getByText(t("place.soon"))).toBeTruthy();
  });

  it("a vila mostra o nível 1 e o avatar escolhido, sem imagem de fora", async () => {
    await withProfile();
    const { container } = render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
    await screen.findByText(t("hud.level", { n: 1 }), { exact: false });
    expect(container.querySelectorAll("img, canvas, [style]").length).toBe(0);
    expect(container.querySelectorAll("svg[shape-rendering='crispEdges']").length).toBeGreaterThan(1);
  });

  it("a vila lê o nível, o título e a barra do livro-razão (W2-07)", async () => {
    await withProfile();
    // 500 XP no total: nível 5 (começa em 500), Viajante, barra vazia, faltam 250.
    await appendEvent(db, { now: () => 5, uuid: () => "dev" }, { id: "run:a", kind: "mission_completed", xp: 300, coins: 0, rules: 1 });
    await appendEvent(db, { now: () => 6, uuid: () => "dev" }, { id: "first:m", kind: "mission_first", xp: 200, coins: 5, rules: 1 });
    const { container } = render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
    await screen.findByText(`${t("hud.level", { n: 5 })} · ${t("hud.title.traveler")}`);
    expect(screen.getByText(t("hud.xp", { into: 0, total: 250 }))).toBeTruthy();
    const bar = container.querySelector("progress.xp");
    expect(bar?.getAttribute("aria-hidden")).toBe("true");
    expect([bar?.getAttribute("value"), bar?.getAttribute("max")]).toEqual(["0", "250"]);
  });

  it("sem eventos a vila mostra nível 1, Aprendiz e a barra vazia", async () => {
    await withProfile();
    const { container } = render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
    await screen.findByText(`${t("hud.level", { n: 1 })} · ${t("hud.title.apprentice")}`);
    expect(screen.getByText(t("hud.xp", { into: 0, total: 50 }))).toBeTruthy();
    expect(container.querySelector("progress.xp")?.getAttribute("value")).toBe("0");
  });

  it("um local que não existe em locations.json cai no 404", async () => {
    await withProfile();
    renderAt("/place/castelo");
    expect(await screen.findByRole("heading", { level: 1, name: t("notfound.title") })).toBeTruthy();
  });

  it("id esquisito na URL também cai no 404 (nada de ler a cadeia de protótipos)", async () => {
    await withProfile();
    renderAt("/place/constructor");
    expect(await screen.findByRole("heading", { level: 1, name: t("notfound.title") })).toBeTruthy();
  });
});
