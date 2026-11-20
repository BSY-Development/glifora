// Unidade dos auxiliares do QA Tester: hiddenChars tem de pegar controle, bidi e largura zero, e só eles. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { CH, hiddenChars } from "./support/w2";

test("hiddenChars: controle, bidi e largura zero são pegos", () => {
  expect(hiddenChars(CH.rlo)).toBe(true);
  expect(hiddenChars(CH.zwsp)).toBe(true);
  expect(hiddenChars(CH.nul)).toBe(true);
  expect(hiddenChars(CH.bel)).toBe(true);
  expect(hiddenChars(CH.lri)).toBe(true);
  expect(hiddenChars(["a", CH.rlo, "b"].join(""))).toBe(true);
});

test("hiddenChars: texto comum não é pego (nem as letras p, c, C, f, Z, l)", () => {
  expect(hiddenChars("abc pCf Zl {x} Zp")).toBe(false);
  expect(hiddenChars("João Açaí")).toBe(false);
  expect(hiddenChars("")).toBe(false);
});
