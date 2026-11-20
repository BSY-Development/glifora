// W1-14 — guardas dos princípios pedagógicos (SPEC) no que a fase 1 já alcança. Dono: Revisor.
// Fase 2 em diante: estes testes ganham o player (sem vidas, recast sem tela de erro, XP só por esforço, tocar vale menos).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const prod = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

describe("princípio 6 · sem vidas, sem punição por erro", () => {
  for (const lang of ["pt-BR", "en"]) {
    it(`nenhum texto de interface em ${lang} fala de vidas, game over, corações, penalidade ou perda de ofensiva`, () => {
      const values = Object.entries(JSON.parse(read(`i18n/${lang}.json`)) as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : Object.values(v as object).map((x) => [k, String(x)])));
      const bad = values.filter(([, v]) => /\b(vidas?|lives|life|game over|fim de jogo|cora[cç][õo]es|hearts?|penalidade|penalty|punição|punish|perdeu|you lost|streak lost|ofensiva (perdida|zerada))\b/i.test(String(v)));
      expect(bad).toEqual([]);
    });
  }
  it("o código não tem contador de vidas nem de tentativas que bloqueie o jogo", () => {
    const bad = prod.filter((f) => /\b(lives|hearts|livesLeft|gameOver|game_over|attemptsLeft)\b/.test(read(f)));
    expect(bad).toEqual([]);
  });
});

describe("princípio 7 · recompensa só por esforço real (fase 1: nada concede XP, moeda ou ofensiva)", () => {
  it("os documentos locais não têm campo de XP, moedas ou ofensiva (chegam com o motor, na fase 2/3)", () => {
    const schema = read("src/data/schema/docs.ts");
    expect(schema).not.toMatch(/\b(xp|coins?|moedas?|streak)\b/i);
  });
  it("a barra de XP é só desenho (escondida do leitor de tela, com o número em texto) e nada no código escreve XP fora do motor", () => {
    const home = read("src/ui/screens/Home.tsx");
    expect(home).toMatch(/<progress[^>]*className="xp"[^>]*aria-hidden="true"|<progress[^>]*aria-hidden="true"[^>]*className="xp"/);
    expect(home).toContain('t("hud.xp"');
    expect(prod.filter((f) => /\b(addXp|grantXp|awardXp|giveXp|earnXp|addCoins)\b/i.test(read(f)))).toEqual([]);
  });
});

describe("princípio 8 · transparência: a tela não afirma nível CEFR nem progresso que não existe", () => {
  it("nenhum texto de interface diz um nível CEFR (A1…C2) como se fosse do jogador", () => {
    for (const lang of ["pt-BR", "en"]) {
      const text = Object.values(JSON.parse(read(`i18n/${lang}.json`)) as Record<string, unknown>).map((v) => JSON.stringify(v)).join("\n");
      expect(text, lang).not.toMatch(/\b[ABC][12]\b/);
    }
  });
});
