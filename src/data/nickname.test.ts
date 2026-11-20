import { describe, expect, it } from "vitest";
import { NICKNAME_MAX, Nickname, ProfileV1 } from "./schema/docs";

describe("apelido (texto puro, com limite)", () => {
  it.each(["", "Ana", "João da Silva", "日本語", "😀 oi", "O'Neil & Cia", "a".repeat(NICKNAME_MAX)])("aceita %j", (value) => {
    expect(Nickname.safeParse(value).success).toBe(true);
  });

  it("conta por caractere: 30 emojis cabem, 31 não", () => {
    expect(Nickname.safeParse("😀".repeat(NICKNAME_MAX)).success).toBe(true);
    expect(Nickname.safeParse("😀".repeat(NICKNAME_MAX + 1)).success).toBe(false);
  });

  it.each(["<b>oi</b>", "a>b", "<script>", "linha\nnova", "tab\there", "nulo\u0000", "‮evil", "⁦x"])("recusa %j", (value) => {
    expect(Nickname.safeParse(value).success).toBe(false);
  });

  it("vale também no documento do perfil (e portanto na importação)", () => {
    expect(ProfileV1.safeParse({ nickname: "<img src=x onerror=alert(1)>", createdAt: 1 }).success).toBe(false);
    expect(ProfileV1.safeParse({ nickname: "Ana", createdAt: 1 }).success).toBe(true);
  });
});
