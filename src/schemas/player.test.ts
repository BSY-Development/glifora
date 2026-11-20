import { describe, expect, it } from "vitest";
import { countPlayerVocatives, fillPlayer, hasPlayerMarker, isPlayerMarkerWellFormed, spokenName } from "./player";

describe("spokenName (D-53, nome falado)", () => {
  it.each([
    // A tabela do dono.
    ["Maria", "Maria"],
    ["João", "João"],
    ["Maria Clara", "Maria"],
    ["Ana-Lu", "Ana-Lu"],
    ["Alexandrina", null], // 11 letras
    ["Bia🙂", null],
    ["xX_Pro_Xx", null],
    ["", null],
    ["Guilherme Augusto", "Guilherme"],
    // Bordas.
    [null, null],
    [undefined, null],
    ["   ", null],
    ["  Bia  ", "Bia"],
    ["D'Ávila", "D'Ávila"],
    ["D\u2019Ávila", "D\u2019Ávila"], // apóstrofo tipográfico
    ["Joa\u0303o", "João"], // acento separado (NFD) vira NFC
    ["Ana-Lu-Bia", null], // dois hífens; e não tem 1ª palavra separada por espaço
    ["Ana--Lu", null],
    ["-Ana", null],
    ["Ana-", null],
    ["Mary-Elizabeth", null], // 13 letras: o hífen não salva
    ["Mary-Elizabe", null], // 11 letras
    ["Mary-Eliza", "Mary-Eliza"], // 9 letras + hífen
    ["Abcdefghij", "Abcdefghij"], // 10 letras
    ["Alexandrina Souza", null], // 1ª palavra também passa de 10
    ["Bia 🙂", "Bia"],
    ["🙂 Bia", null], // a 1ª palavra é o emoji
    ["Ana2", null],
    ["Ana, a brava", null], // "Ana," tem vírgula
    ["Lu 🌻", "Lu"],
    ["👩‍🚀", null],
    ["$&", null],
    ["{player}", null],
    ["Ana_Bia", null],
    ["Zoë", "Zoë"],
  ])("%j → %j", (nick, expected) => {
    expect(spokenName(nick)).toBe(expected);
  });
});

describe("fillPlayer (D-53)", () => {
  it.each([
    ["Good morning, {player}!", "Maria", "Good morning, Maria!"],
    ["Good morning, {player}!", null, "Good morning!"],
    ["Good morning, {player}!", undefined, "Good morning!"],
    ["Good morning, {player}!", "", "Good morning!"],
    ["Good morning, {player}!", "   ", "Good morning!"],
    ["Good morning, {player}!", "Maria Clara", "Good morning, Maria!"],
    ["Good morning, {player}!", "Alexandrina", "Good morning!"],
    ["Good morning, {player}!", "xX_Pro_Xx", "Good morning!"],
    ["Here you go, {player}, that's three dollars.", "Bia", "Here you go, Bia, that's three dollars."],
    ["Here you go, {player}, that's three dollars.", null, "Here you go, that's three dollars."],
    ["See you, {player}. Bye, {player}!", "Jo", "See you, Jo. Bye, Jo!"],
    ["See you, {player}. Bye, {player}!", null, "See you. Bye!"],
    ["Bom dia, {player}!", "João", "Bom dia, João!"],
    ["No marker here.", "Maria", "No marker here."],
  ])("%j com %j → %j", (text, nick, expected) => {
    expect(fillPlayer(text, nick)).toBe(expected);
  });

  it("apelido com vírgula, emoji ou padrões do replace ($&) nunca entra cru na fala", () => {
    expect(fillPlayer("Thanks, {player}!", "Ana, a brava")).toBe("Thanks!");
    expect(fillPlayer("Thanks, {player}!", "Lu 🌻")).toBe("Thanks, Lu!");
    expect(fillPlayer("Thanks, {player}!", "Bia🙂")).toBe("Thanks!");
    expect(fillPlayer("Thanks, {player}!", "👩‍🚀")).toBe("Thanks!");
    expect(fillPlayer("Hi, {player}!", "$&")).toBe("Hi!");
    expect(fillPlayer("Hi, {player}!", "{player}")).toBe("Hi!");
  });

  it("só troca a forma certa: marcador sem vírgula fica (a conferência da missão barra antes)", () => {
    expect(fillPlayer("Hi {player}!", "Maria")).toBe("Hi {player}!");
  });
});

describe("conferência do marcador", () => {
  it("hasPlayerMarker pega o marcador certo e as variações erradas", () => {
    for (const s of ["Hi, {player}!", "Hi {player}", "Hi, {Player}!", "Hi, { player }!", "{PLAYER}"]) expect(hasPlayerMarker(s)).toBe(true);
    for (const s of ["Hi, player!", "Hi!", "{nome}"]) expect(hasPlayerMarker(s)).toBe(false);
  });

  it("isPlayerMarkerWellFormed só aceita ', {player}' e nenhuma outra chave", () => {
    for (const s of ["Hi, {player}!", "Hi!", "Hi, {player}. Bye, {player}!"]) expect(isPlayerMarkerWellFormed(s)).toBe(true);
    for (const s of ["Hi {player}!", "Hi,{player}!", "Hi, {Player}!", "Hi, {nome}!", "Hi, {player}! }", "Hi,  {player}!"]) {
      expect(isPlayerMarkerWellFormed(s)).toBe(false);
    }
  });

  it("countPlayerVocatives conta só a forma certa", () => {
    expect(countPlayerVocatives("Hi!")).toBe(0);
    expect(countPlayerVocatives("Hi, {player}! Bye, {player}!")).toBe(2);
    expect(countPlayerVocatives("Hi {player}!")).toBe(0);
  });
});
