import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkClosingAnswer, closingTargets, matchReply, parseMission, type Mission } from "../../src/schemas/index.ts";
import { buildContent, readContentDir, type ContentFile } from "./lib.ts";

const contentDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content");
const real = readContentDir(contentDir);

/** Cópia profunda dos arquivos reais, para estragar um em cada teste. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
function files(): { list: { path: string; json: unknown }[]; get: (path: string) => Loose } {
  const list = real.files.map((f) => ({ path: f.path, json: structuredClone(f.json) }));
  return { list, get: (path) => list.find((f) => f.path === path)!.json };
}
const messages = (list: readonly ContentFile[]) => buildContent(list).issues.map((i) => `${i.file} ${i.path}: ${i.message}`);
const BAKERY = "missions/pt-BR_en/A1/bakery-01.json";

function mission(id: string): Mission {
  const f = real.files.find((x) => x.path.endsWith(`/${id}.json`))!;
  const res = parseMission(f.json);
  if (!res.ok) throw new Error(JSON.stringify(res.issues));
  return res.mission;
}

describe("conteúdo real (content/)", () => {
  it("todo JSON lê, passa nos schemas, nas conferências e nas regras de qualidade", () => {
    expect(real.issues).toEqual([]);
    expect(messages(real.files)).toEqual([]);
  });

  it("o índice tem as missões em ordem de par, nível e id, com o caminho do arquivo", () => {
    const { index } = buildContent(real.files);
    expect(index.missions.map((m) => m.id)).toContain("bakery-01");
    expect(index.missions.find((m) => m.id === "bakery-01")!.file).toBe(BAKERY);
    const keys = index.missions.map((m) => `${m.base}_${m.target}/${m.level}/${m.id}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("só lê eval/stt/ de dentro de eval/ (D-48)", () => {
    expect(real.files.filter((f) => f.path.startsWith("eval/")).every((f) => f.path.startsWith("eval/stt/"))).toBe(true);
  });
});

describe("bakery-01: partida com respostas naturais", () => {
  const m = mission("bakery-01");
  const node = (id: string) => m.nodes.find((n) => n.id === id)!;
  const pick = (id: string, said: string) => matchReply(node(id).replies, said, "en")?.index ?? null;

  it.each([
    ["greet", "Hi!", 0],
    ["greet", "Good morning, Tilda!", 0],
    ["greet", "It smells amazing!", 1],
    ["order", "Can I have a honey roll?", 0],
    ["order", "One cheese roll, please", 1],
    ["order", "I want a roll of honey", 2],
    ["how-many", "Just one", 0],
    ["how-many", "2", 1],
    ["how-many", "two rolls please", 1],
    ["how-many", "I want two roll", 2],
    ["anything-else", "A loaf of bread too, please.", 0],
    ["anything-else", "No thanks, that's all.", 1],
    ["anything-else", "Nothing else", 1],
    ["anything-else", "two breads", 2],
    ["pay", "Here you are.", 0],
    ["pay", "Thanks!", 1],
    ["pay", "Thanks you very much", 2],
  ])("%s: %j → %i", (id, said, idx) => expect(pick(id, said)).toBe(idx));

  it("o fecho aceita frases próprias com palavras da padaria e recusa o resto", () => {
    const targets = closingTargets(m);
    const ok = (s: string) => checkClosingAnswer(targets, s, "en").accepted;
    expect(ok("Can I have an apple pie?")).toBe(true);
    expect(ok("Two loaves of bread, please.")).toBe(true);
    expect(ok("honey rolls again!")).toBe(true);
    expect(ok("Hot chocolate, please.")).toBe(false);
    expect(ok("See you tomorrow!")).toBe(false);
  });
});

describe("build-index pega cada tipo de problema", () => {
  it("missão no lugar errado: pasta do par, pasta do nível, nome do arquivo", () => {
    const f = files();
    f.list.find((x) => x.path === BAKERY)!.path = "missions/pt-BR_en/A2/bakery-01.json";
    expect(messages(f.list).join("\n")).toContain("não bate com a pasta A2");
    const g = files();
    g.list.find((x) => x.path === BAKERY)!.path = "missions/pt-BR_en/A1/bakery-99.json";
    expect(messages(g.list).join("\n")).toContain("não bate com o nome do arquivo");
    const h = files();
    h.list.find((x) => x.path === BAKERY)!.path = "missions/bakery-01.json";
    expect(messages(h.list).join("\n")).toContain("missions/<base>_<alvo>/<nível>/<id>.json");
  });

  it("erro de schema ou de conferência na missão sai com arquivo e caminho, e a missão fica fora do índice", () => {
    const f = files();
    f.get(BAKERY).nodes[0].text = "x".repeat(301);
    const res = buildContent(f.list);
    expect(res.issues.some((i) => i.file === BAKERY && i.path === "nodes[0].text")).toBe(true);
    expect(res.index.missions.some((m) => m.id === "bakery-01")).toBe(false);
  });

  it("pattern fora do catálogo do par", () => {
    const f = files();
    f.get(BAKERY).nodes[1].replies[2].pattern = "en.made_up";
    expect(messages(f.list).join("\n")).toContain('padrão "en.made_up" não está no catálogo');
  });

  it("qualidade: fala acima do teto do nível, dígito, símbolo e falta de pontuação", () => {
    const f = files();
    const m = f.get(BAKERY);
    m.nodes[0].text = "Good morning! Oh, a new face. Welcome to my bakery, the best one in the whole village!";
    m.nodes[1].text = "That's 3 coins.";
    m.nodes[2].text = "How many? :)";
    m.closing.success.text = "See you tomorrow";
    const all = messages(f.list).join("\n");
    expect(all).toContain("o teto do A1 é 80");
    expect(all).toContain("por extenso");
    expect(all).toContain("termine a fala");
  });

  it("qualidade: bebida alcoólica em qualquer texto, em inglês ou português", () => {
    for (const spoil of [
      (m: Loose) => (m.nodes[1].replies[0].text = "Can I have a beer, please?"),
      (m: Loose) => (m.closing.target_words.push("wine")),
      (m: Loose) => (m.nodes[1].replies[0].translation = "Uma cachaça, por favor."),
    ]) {
      const f = files();
      spoil(f.get(BAKERY));
      expect(messages(f.list).join("\n")).toContain("bebida alcoólica");
    }
    const ok = files();
    ok.get(BAKERY).nodes[1].replies[0].text = "Can I have a ginger cookie? It's run out?";
    expect(messages(ok.list).join("\n")).not.toContain("bebida alcoólica"); // gin e rum só como palavra inteira
  });

  it("NPC: ficha faltando, ficha fora do local da vila, sem falas no idioma-alvo", () => {
    const f = files();
    f.list.splice(f.list.findIndex((x) => x.path === "npcs/tilda.json"), 1);
    expect(messages(f.list).join("\n")).toContain("falta a ficha npcs/tilda.json");
    const g = files();
    g.get("npcs/tilda.json").location = "tavern";
    expect(messages(g.list).join("\n")).toContain("não põe tilda em tavern");
    const h = files();
    delete h.get("npcs/tilda.json").lines.en;
    h.get("npcs/tilda.json").lines.es = { retry: { text: "¿Cómo?" }, contingency: { text: "¿Perdón?" } };
    expect(messages(h.list).join("\n")).toContain("não tem falas fixas (lines.en)");
  });

  it("teste de voz: missão, fala ou resposta que não existem, e frase que não casa com a resposta", () => {
    const cases: [(e: Loose) => void, string][] = [
      [(e) => (e.phrases[0].expect.mission = "nowhere-01"), "missão nowhere-01 não existe"],
      [(e) => (e.phrases[0].expect.node = "nowhere"), "a fala nowhere não existe"],
      [(e) => (e.phrases[0].expect = { mission: "bakery-01", node: "greet", reply: 2 }), "só tem 2 respostas"],
      [(e) => (e.phrases[0].text = "Two breads, please."), "não casa"],
    ];
    for (const [spoil, piece] of cases) {
      const f = files();
      spoil(f.get("eval/stt/pt-BR_en.json"));
      expect(messages(f.list).join("\n"), piece).toContain(piece);
    }
  });

  it("catálogo de erros com nome de arquivo errado e missão sem catálogo do par", () => {
    const f = files();
    f.list.find((x) => x.path === "patterns/pt-BR_en.json")!.path = "patterns/en.json";
    const all = messages(f.list).join("\n");
    expect(all).toContain("patterns/pt-BR_en.json");
  });
});
