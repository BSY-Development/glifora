import { z } from "zod";

// Peças de texto comuns aos schemas de conteúdo. Todo texto é dado puro (SPEC, "Validação"): nada de
// caractere de controle, e o app sempre mostra como texto, nunca como HTML.

/** Caracteres de controle (C0, DEL, C1) e separadores de linha/parágrafo do Unicode. */
export function hasControl(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
  }
  return false;
}

/** Texto de uma linha, sem espaço nas pontas (o parse apara), de 1 até `max` caracteres. */
export function text(max: number) {
  return z
    .string()
    .trim()
    .min(1, "não pode ficar vazio")
    .max(max, `passou de ${max} caracteres`)
    .refine((s) => !hasControl(s), "tem caractere de controle (quebra de linha, tabulação...)");
}

/** Id curto dentro de um arquivo (fala, personagem): "order", "tilda", "step-2". */
export const LocalId = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/, "use minúsculas, números, '-' e '_' (1 a 32)");
