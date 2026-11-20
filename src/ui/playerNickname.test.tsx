// @vitest-environment jsdom
// W2-18 (D-53): a NPC chama a pessoa pelo apelido; sem apelido, a frase continua natural. Nunca sobra "{player}" na tela.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { list, load } from "../catalog";
import { openDb, type GliforaDb } from "../data";
import { initLocale, t } from "../i18n";
import { fillPlayer, type Mission } from "../schemas";
import { fillMission } from "../services/play";
import { saveNickname } from "../services/player";
import { setStorageForTest } from "../services/storage";
import { routes } from "./routes";

let db: GliforaDb;

beforeEach(async () => {
  localStorage.clear();
  initLocale(["pt-BR"]);
  db = await openDb("glifora-nickname-test");
  setStorageForTest(db);
});
afterEach(async () => {
  cleanup();
  setStorageForTest(null);
  db.close();
  await db.delete();
});

const missionOf = async (id: string): Promise<Mission> => {
  const loaded = await load(id);
  if (!loaded.ok) throw new Error(`${id} não abriu`);
  return loaded.mission;
};

describe("fillMission", () => {
  it("troca nas falas das NPCs, em todas as missões; sem apelido o vocativo some e nada de {player} sobra", async () => {
    const entries = await list({ base: "pt-BR", target: "en" });
    expect(entries.length).toBeGreaterThan(0);
    let withMarker = 0;
    for (const entry of entries) {
      const raw = await missionOf(entry.id);
      const before = JSON.stringify(raw);
      if (before.includes("{player}")) withMarker += 1;
      const named = JSON.stringify(fillMission(raw, "Maria"));
      const anon = JSON.stringify(fillMission(raw, null));
      expect(named, entry.id).not.toContain("{player}");
      expect(anon, entry.id).not.toContain("{player}");
      expect(anon, entry.id).not.toContain(", ,");
      if (before.includes("{player}")) expect(named).toContain(", Maria");
    }
    expect(withMarker).toBeGreaterThan(0);
  });

  it("só o nome falado entra (D-53): apelido estranho some o vocativo, apelido comprido vira a 1ª palavra; a original não muda", async () => {
    const raw = await missionOf("bakery-02");
    const before = JSON.stringify(raw);
    expect(JSON.stringify(fillMission(raw, "$&<b>"))).not.toMatch(/\$&|<b>|\{player\}/);
    expect(JSON.stringify(fillMission(raw, "Maria Clara Santos"))).toContain(", Maria");
    expect(JSON.stringify(raw)).toBe(before);
    expect(fillPlayer("Hi, {player}!", "  ")).toBe("Hi!");
  });
});

describe("player com e sem apelido", () => {
  async function playUntilLike(nick: string | null) {
    if (nick !== null) await saveNickname(nick);
    else await saveNickname("");
    const raw = await missionOf("bakery-02");
    const mission = fillMission(raw, nick);
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/play/bakery-02"] })} />);
    fireEvent.click(await screen.findByRole("button", { name: t("play.start") }));
    for (let i = 0; i < mission.listen.length; i++) {
      await screen.findByText(mission.listen[i]!.text);
      fireEvent.click(await screen.findByRole("button", { name: i + 1 >= mission.listen.length ? t("play.listen.last") : t("play.listen.continue") }));
    }
    const like = mission.nodes.findIndex((n) => n.id === "like");
    for (let i = 0; i <= like; i++) {
      await screen.findByText(mission.nodes[i]!.text);
      if (i === like) break;
      fireEvent.change(await screen.findByLabelText(t("play.input.label")), { target: { value: mission.nodes[i]!.replies[0]!.text } });
      fireEvent.click(screen.getByRole("button", { name: t("play.input.send") }));
      fireEvent.click(await screen.findByRole("button", { name: t("play.continue") }));
    }
    return mission.nodes[like]!;
  }

  it("com apelido a Tilda fala o nome", async () => {
    const node = await playUntilLike("Maria");
    expect(node.text).toContain(", Maria");
    expect(screen.queryByText(/\{player\}/)).toBeNull();
  });

  it("sem apelido a frase sai natural, sem vírgula sobrando", async () => {
    const node = await playUntilLike(null);
    expect(node.text).not.toMatch(/,\s*[?!.]/);
    expect(screen.queryByText(/\{player\}/)).toBeNull();
  });
});
