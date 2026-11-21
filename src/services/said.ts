// O que a pessoa disse e o jeito natural de dizer (D-54, D-55). A conta é do Conteúdo (src/schemas/natural.ts);
// aqui só se reduz o resultado ao que o relatório mostra, num lugar só.
import { closingModel, naturalWay, type Mission, type NaturalWay } from "../schemas";

/** `natural`: já foi do jeito natural (nada a mostrar) · `recast`: a correção · `model`: o jeito natural de dizer. */
export type SaidWay = { kind: "natural" } | { kind: "recast"; text: string } | { kind: "model"; text: string; translation: string };

const NATURAL: SaidWay = { kind: "natural" };

function reduce(way: NaturalWay | null): SaidWay {
  if (way === null || way.kind === "natural") return NATURAL;
  return way.kind === "recast" ? { kind: "recast", text: way.corrected } : { kind: "model", text: way.text, translation: way.translation };
}

/** O que mostrar ao lado do que a pessoa disse numa fala da missão (`reply`: a resposta que o player casou, se foi guardada). */
export function wayOfAnswer(mission: Mission, answer: { node: string; reply?: number | undefined; said: string }): SaidWay {
  return reduce(naturalWay(mission, answer));
}

/** O que mostrar ao lado da frase do fecho. */
export function wayOfClosing(mission: Mission, said: string): SaidWay {
  return reduce(closingModel(mission, said));
}
