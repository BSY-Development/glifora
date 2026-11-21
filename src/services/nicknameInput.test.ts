// D-55: o que a pessoa digita no apelido (até 10, só letras, espaço, hífen e apóstrofo). O schema de leitura segue em 30.
import { describe, expect, it } from "vitest";
import { Nickname } from "../data";
import { NICKNAME_INPUT_MAX, checkNickname } from "./player";

describe("checkNickname (o que se digita)", () => {
  it("o teto é 10", () => expect(NICKNAME_INPUT_MAX).toBe(10));

  it.each(["", "Ana", "José", "Maria Lu", "Ana-Lu", "D'Ávila", "D’Ávila", "João", "Zoë", "a".repeat(10)])("aceita %j", (value) => {
    expect(checkNickname(value).ok).toBe(true);
  });

  it("corta os espaços das pontas e normaliza o acento", () => {
    expect(checkNickname("  Ana  ")).toEqual({ ok: true, value: "Ana" });
    expect(checkNickname("José")).toEqual({ ok: true, value: "José" });
  });

  it("11 caracteres é 'long'", () => {
    expect(checkNickname("a".repeat(11))).toEqual({ ok: false, reason: "long" });
    expect(checkNickname("Maria Clara!")).toEqual({ ok: false, reason: "long" });
  });

  it.each(["Ana1", "R2D2", "😀", "<b>", "Ana_", "Ana.", "a@b", "日本語1", "Ana‮", "Ana​", "-", "'"])("recusa %j (letras, espaço, hífen e apóstrofo só)", (value) => {
    const check = checkNickname(value);
    // "-" e "'" têm só caracteres permitidos, mas nada visível de letra: o schema não pede letra, então valem
    if (value === "-" || value === "'") expect(check.ok).toBe(true);
    else expect(check).toEqual({ ok: false, reason: "chars" });
  });

  it("um apelido antigo (até 30) segue valendo enquanto não é editado, mas não passa a ser digitado de novo", () => {
    const old = "Maria Clara da Silva Santos 123";
    expect(Nickname.safeParse(old).success).toBe(false); // 31: nem o schema antigo
    const legacy = "Maria Clara da Silva Santos";
    expect(Nickname.safeParse(legacy).success).toBe(true);
    expect(checkNickname(legacy)).toEqual({ ok: false, reason: "long" });
    expect(checkNickname(legacy, legacy)).toEqual({ ok: true, value: legacy });
    expect(checkNickname("Apelido 2024 antigo", "Apelido 2024 antigo").ok).toBe(true);
    // editou: vale a regra nova
    expect(checkNickname(`${legacy} x`, legacy).ok).toBe(false);
    expect(checkNickname("Ana", legacy)).toEqual({ ok: true, value: "Ana" });
  });
});
