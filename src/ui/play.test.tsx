// @vitest-environment jsdom
// W2-08 e W2-09: o player da bakery-01 do começo ao fim por texto, a ajuda, o "não casou", o recast destacado, a sessão
// retomável e o relatório. A voz tem dublê no teste do Revisor (e2e); aqui o caminho é digitar.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { load } from "../catalog";
import { listEvents, listRuns, loadSession, openDb, type GliforaDb } from "../data";
import { initLocale, t } from "../i18n";
import type { Mission } from "../schemas";
import { setStorageForTest } from "../services/storage";
import { routes } from "./routes";

let db: GliforaDb;
let mission: Mission;

beforeEach(async () => {
  localStorage.clear();
  initLocale(["pt-BR"]);
  db = await openDb("glifora-play-test");
  setStorageForTest(db);
  const loaded = await load("bakery-01");
  if (!loaded.ok) throw new Error("bakery-01 não abriu");
  mission = loaded.mission;
});

afterEach(async () => {
  cleanup();
  setStorageForTest(null);
  db.close();
  await db.delete();
});

const open = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const start = async () => fireEvent.click(await screen.findByRole("button", { name: t("play.start") }));
const nodeText = (index: number) => mission.nodes[index]!.text;

async function type(text: string) {
  const field = await screen.findByLabelText(t("play.input.label"));
  fireEvent.change(field, { target: { value: text } });
  click(t("play.input.send"));
}

/** Responde a fala `index` com a resposta `reply` (digitando) e segue. */
async function answer(index: number, reply: number) {
  await screen.findByText(nodeText(index));
  await type(mission.nodes[index]!.replies[reply]!.text);
  await screen.findByText(/\+\d+ XP$/);
}

async function listenAll() {
  for (let i = 0; i < mission.listen.length; i++) {
    await screen.findByText(mission.listen[i]!.text);
    fireEvent.click(await screen.findByRole("button", { name: i + 1 >= mission.listen.length ? t("play.listen.last") : t("play.listen.continue") }));
  }
}

describe("lista de missões do local", () => {
  it("mostra a missão com título, meta, estrelas e a marca de XP cheio", async () => {
    open("/place/bakery");
    const link = await screen.findByRole("link", { name: new RegExp(mission.title) });
    expect(link.getAttribute("href")).toBe("/play/bakery-01");
    expect(within(link).getByText(mission.can_do)).toBeTruthy();
    expect(within(link).getByText(t("place.mission.stars", { n: 0 }))).toBeTruthy();
    expect(within(link).getByText(t("place.mission.full"))).toBeTruthy();
    expect(link.textContent).not.toContain("−50%");
  });
});

describe("player", () => {
  it("joga a bakery-01 inteira por texto: XP, estrela, relatório", async () => {
    open("/play/bakery-01");
    await screen.findByRole("heading", { level: 1, name: mission.title });
    // O modo sugerido na 1ª vez é "com a frase".
    expect((screen.getByRole("radio", { name: new RegExp(t("play.mode.1")) }) as HTMLInputElement).checked).toBe(true);
    await start();

    await listenAll();
    for (let i = 0; i < mission.nodes.length; i++) {
      await answer(i, 0);
      expect(screen.getByText(t("play.xp", { n: 8 }))).toBeTruthy(); // digitou com a frase à vista
      click(t("play.continue"));
    }
    // Fecho: uma palavra-alvo basta; o `<` não passa para o registro.
    await screen.findByText(mission.closing.question.text);
    await type(`<b>${mission.closing.target_words![0]}</b>`);
    fireEvent.click(await screen.findByRole("button", { name: t("play.done.report") }));

    await screen.findByRole("heading", { level: 1, name: t("report.title") });
    // 5 respostas × 8 + fecho 24 = conversa; prêmios: 1ª conclusão 24 + ★ 40.
    const n = mission.nodes.length;
    const conversation = n * 8 + 24;
    expect(await screen.findByText(t("report.xp.conversation", { n: conversation }))).toBeTruthy();
    expect(screen.getByText(t("report.xp.prizes", { n: 64 }))).toBeTruthy();
    expect(screen.getByText(t("report.xp.total", { n: conversation + 64 }))).toBeTruthy();
    expect(screen.getByText(t("report.stars", { n: 1 }))).toBeTruthy();
    expect(screen.getByText(t("report.cando.yes"))).toBeTruthy();
    expect(screen.getByText(mission.can_do)).toBeTruthy();
    expect(screen.getByText(mission.closing.model_answer.text)).toBeTruthy();
    expect(screen.getByRole("link", { name: t("report.next.again", { mode: t("play.mode.2") }) })).toBeTruthy();
    for (const word of mission.vocabulary) expect(screen.getByText(word.term)).toBeTruthy();

    const [runs, events] = await Promise.all([listRuns(db), listEvents(db)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.closing?.text).not.toMatch(/[<>]/);
    expect(runs[0]).toMatchObject({ canDo: true, level: 1, xp: conversation });
    expect(events.map((e) => e.kind).sort()).toEqual(["mission_completed", "mission_first", "mission_star"]);
    expect(await loadSession(db)).toBeNull(); // rodada concluída: nada a retomar
  });

  it("de cor (modo 3): 16 XP por resposta e as três estrelas", async () => {
    open("/play/bakery-01");
    fireEvent.click(await screen.findByRole("radio", { name: t("play.mode.3") }));
    await start();
    await listenAll();
    for (let i = 0; i < mission.nodes.length; i++) {
      await answer(i, 0);
      expect(screen.getByText(t("play.xp", { n: 16 }))).toBeTruthy();
      click(t("play.continue"));
    }
    await type(mission.closing.target_words![0]!);
    fireEvent.click(await screen.findByRole("button", { name: t("play.done.report") }));
    await screen.findByText(t("report.stars", { n: 3 }));
    expect(screen.getByText(t("report.stars.new"))).toBeTruthy();
    // 24 + 40 + 56 + 80 de prêmios; subiu de nível (nível 1 custa 50 XP).
    expect(screen.getByText(t("report.xp.prizes", { n: 200 }))).toBeTruthy();
    expect(screen.getByText(/Subiu para o nível|You reached level/)).toBeTruthy();
  });

  it("não casou: a NPC pede para repetir; na 2ª falha a ajuda sobe sozinha; nada trava", async () => {
    open("/play/bakery-01");
    fireEvent.click(await screen.findByRole("radio", { name: t("play.mode.3") }));
    await start();
    await listenAll();
    await screen.findByText(nodeText(0));
    await type("zzz qqq");
    await screen.findByText(/Sorry, dear\?/);
    expect(screen.queryByText(t("play.help.raised"))).toBeNull();
    await type("zzz qqq");
    await screen.findByText(t("play.help.raised"));
    // Subiu um degrau (de nada para a ideia): as ideias aparecem e dá para responder.
    expect(screen.getByText(t("play.help.idea_title"))).toBeTruthy();
    await type(mission.nodes[0]!.replies[0]!.text);
    await screen.findByText(/\+\d+ XP$/);
    expect(screen.getByText(t("play.xp", { n: 12 }))).toBeTruthy(); // 16 → 12 pela ajuda em vigor (a ideia)
  });

  it("ajuda livre até tocar; tocar vale 4 e não dá estrela", async () => {
    open("/play/bakery-01");
    await start();
    await listenAll();
    await screen.findByText(nodeText(0));
    // Modo 1 já mostra a frase; mais uma ajuda e as opções viram botões.
    expect(screen.getByText(t("play.help.phrase_title"))).toBeTruthy();
    click(t("play.help.tap"));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(mission.nodes[0]!.replies[0]!.text) }));
    await screen.findByText(t("play.xp", { n: 4 }));
  });

  it("a resposta com erro mostra o recast destacado, como texto, e o relatório explica o padrão", async () => {
    const flawedAt = mission.nodes.findIndex((n) => n.replies.some((r) => r.flawed && r.recast && r.reaction?.text.includes(r.recast.corrected)));
    expect(flawedAt).toBeGreaterThanOrEqual(0);
    const flawed = mission.nodes[flawedAt]!.replies.findIndex((r) => r.flawed);
    const reply = mission.nodes[flawedAt]!.replies[flawed]!;

    open("/play/bakery-01");
    await start();
    await listenAll();
    for (let i = 0; i < mission.nodes.length; i++) {
      await answer(i, i === flawedAt ? flawed : 0);
      if (i === flawedAt) {
        const mark = document.querySelector("mark.recast");
        expect(mark?.textContent?.toLowerCase()).toBe(reply.recast!.corrected.toLowerCase());
        expect(mark?.children.length).toBe(0); // texto puro, nunca HTML
      }
      click(t("play.continue"));
    }
    await type(mission.closing.target_words![0]!);
    fireEvent.click(await screen.findByRole("button", { name: t("play.done.report") }));
    await screen.findByText(t("report.recasts.title"));
    const said = t("report.recasts.said", { original: reply.recast!.original, corrected: reply.recast!.corrected });
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === said)).toBeTruthy();
    // R-W2-11-1: os trechos em inglês levam lang do idioma-alvo.
    expect(screen.getByText(reply.recast!.original, { selector: "span[lang]" }).getAttribute("lang")).toBe(mission.target);
  });

  it("depois das duas tentativas do fecho vem a resposta-modelo; seguir sem dizer não trava", async () => {
    open("/play/bakery-01");
    await start();
    await listenAll();
    for (let i = 0; i < mission.nodes.length; i++) {
      await answer(i, 0);
      click(t("play.continue"));
    }
    await screen.findByText(mission.closing.question.text);
    await type("hmm");
    expect(await screen.findByText(t("play.closing.hint", { hint: mission.closing.hint }))).toBeTruthy(); // dica na 2ª tentativa
    await type("hmm");
    await screen.findByText(t("play.model.text"));
    expect(screen.getByText(mission.closing.model_answer.text)).toBeTruthy();
    click(t("play.model.skip"));
    fireEvent.click(await screen.findByRole("button", { name: t("play.done.report") }));
    await screen.findByText(t("report.closing.tap"));
    expect(screen.getByText(t("report.stars", { n: 0 }))).toBeTruthy(); // tocar não dá estrela
  });

  it("a rodada em andamento volta de onde estava", async () => {
    open("/play/bakery-01");
    await start();
    await listenAll();
    await answer(0, 0);
    click(t("play.continue"));
    await screen.findByText(nodeText(1));
    await waitFor(async () => expect((await loadSession(db))?.missionId).toBe("bakery-01"));
    cleanup(); // fechou o app

    open("/play/bakery-01");
    await screen.findByText(t("play.resume.title"));
    click(t("play.resume.continue"));
    expect(await screen.findByText(nodeText(1))).toBeTruthy();
    // Recomeçar: volta para a escolha do modo.
    cleanup();
    open("/play/bakery-01");
    fireEvent.click(await screen.findByRole("button", { name: t("play.resume.restart") }));
    expect(screen.getByRole("button", { name: t("play.start") })).toBeTruthy();
  });

  it("missão que não existe: tela amigável com caminho de volta", async () => {
    open("/play/nao-existe");
    expect(await screen.findByRole("heading", { level: 1, name: t("play.error.title") })).toBeTruthy();
    expect(screen.getByRole("link", { name: t("place.back") })).toBeTruthy();
  });

  it("relatório inexistente: mensagem e volta para a vila", async () => {
    open("/report/nada");
    expect(await screen.findByText(t("report.missing"))).toBeTruthy();
  });
});
