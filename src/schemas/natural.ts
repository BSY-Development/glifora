// O "jeito natural" de cada fala da pessoa (D-54), para o relatório e o player (D-55). Funções puras: sem I/O,
// sem relógio. O App chama com a missão e o que a pessoa disse; a tabela de testes está em natural.test.ts.
//
// Nas falas (naturalWay):
//   - resposta com erro (`flawed`) → "recast": o trecho com erro e a forma certa na boca da pessoa
//     (`recast.learner`, ou `recast.corrected`);
//   - resposta boa, e a fala já tem o trecho-chave (`chunk`) → "natural" (sem `chunk`, a fala precisa ter
//     o texto inteiro da resposta); tocar na resposta também é "natural", porque é o próprio modelo;
//   - resposta boa sem o trecho-chave (quem disse só "honey") → "model": o texto da resposta;
//   - resposta livre (nome, D-51) → "natural": não há o que corrigir num nome.
// No fecho (closingModel):
//   - os erros previstos da missão (respostas `flawed` sem `recast.local`) valem também ali: o de mais
//     palavras casadas vence, e o empate fica com o que vem antes na missão → "recast";
//   - senão, o modelo mais próximo (closestModel): o que tem mais palavras-alvo em comum com a fala, com
//     empate para o que vem antes ([model_answer, ...models]); sem nada em comum, o `model_answer`.
//     Se a fala já contém esse modelo inteiro → "natural"; senão → "model".

import { checkClosingAnswer, closingTargets, matchReply, normalize, scoreReply } from "./match";
import type { Line, Mission, Reply } from "./mission";

export type NaturalWay =
  /** A fala já está do jeito natural: o relatório mostra só o "Você disse". */
  | { readonly kind: "natural" }
  /** Erro previsto: o trecho com erro (como está na resposta) e a forma certa (na boca da pessoa). */
  | { readonly kind: "recast"; readonly original: string; readonly corrected: string; readonly node: string; readonly reply: number }
  /** O jeito natural de dizer o que a pessoa quis dizer, com a tradução no idioma base. */
  | { readonly kind: "model"; readonly text: string; readonly translation: string };

/** O que se sabe de uma resposta da rodada. `reply` é o índice que o player casou (vale mais que `said`). */
export interface AnswerSaid {
  readonly node: string;
  /** Índice da resposta em `node.replies`, se a rodada guardou. Sem ele, a fala é casada de novo. */
  readonly reply?: number | undefined;
  /** O que a pessoa disse ou digitou (vazio ou ausente = tocou na resposta). */
  readonly said?: string | undefined;
}

/** A expressão aparece inteira, com palavras inteiras e na ordem, depois da normalização? */
function containsWords(haystack: string, needle: string, lang: Mission["target"]): boolean {
  const n = normalize(needle, lang);
  return n.length > 0 && ` ${normalize(haystack, lang)} `.includes(` ${n} `);
}

function recastOf(r: Reply, node: string, reply: number): NaturalWay | null {
  return r.recast ? { kind: "recast", original: r.recast.original, corrected: r.recast.learner ?? r.recast.corrected, node, reply } : null;
}

/** O modelo de uma resposta boa: o próprio texto, com a tradução. */
const modelOf = (r: { text: string; translation: string }): NaturalWay => ({ kind: "model", text: r.text, translation: r.translation });

/**
 * O jeito natural de uma resposta da rodada. null só se a fala não existir na missão (rodada de outra versão).
 * Se a fala não casar com nada (texto antigo ou editado), devolve o modelo da primeira resposta boa.
 */
export function naturalWay(mission: Mission, answer: AnswerSaid): NaturalWay | null {
  const node = mission.nodes.find((n) => n.id === answer.node);
  if (!node) return null;
  const said = (answer.said ?? "").trim();
  const lang = mission.target;

  let index = answer.reply !== undefined && Number.isInteger(answer.reply) && node.replies[answer.reply] ? answer.reply : -1;
  if (index < 0 && said !== "") index = matchReply(node.replies, said, lang)?.index ?? -1;
  if (index < 0) {
    const good = node.replies.find((r) => !r.flawed && !r.free) ?? node.replies.find((r) => !r.flawed)!;
    return modelOf(good);
  }

  const reply = node.replies[index]!;
  if (reply.flawed) return recastOf(reply, node.id, index) ?? modelOf(reply);
  if (reply.free || said === "") return { kind: "natural" };
  return containsWords(said, reply.chunk ?? reply.text, lang) ? { kind: "natural" } : modelOf(reply);
}

/** Os modelos do fecho, o padrão primeiro. */
export function closingModels(mission: Mission): Line[] {
  return [mission.closing.model_answer, ...(mission.closing.models ?? [])];
}

/** O modelo do fecho mais próximo do que a pessoa disse (pelas palavras-alvo em comum). */
export function closestModel(mission: Mission, said: string): Line {
  const models = closingModels(mission);
  const lang = mission.target;
  const heard = closingTargets(mission).filter((t) => checkClosingAnswer([t], said, lang).accepted);
  if (heard.length === 0) return models[0]!;
  let best = models[0]!;
  let top = 0;
  for (const model of models) {
    const common = heard.filter((t) => checkClosingAnswer([t], model.text, lang).accepted).length;
    if (common > top) {
      top = common;
      best = model;
    }
  }
  return best;
}

/** Erro previsto da missão que aparece na frase do fecho (passe exato, como no casamento das falas). */
export function closingRecast(mission: Mission, said: string): Extract<NaturalWay, { kind: "recast" }> | null {
  const lang = mission.target;
  const words = normalize(said, lang).split(" ").filter(Boolean);
  if (words.length === 0) return null;
  let best: Extract<NaturalWay, { kind: "recast" }> | null = null;
  let top = 0;
  for (const node of mission.nodes) {
    node.replies.forEach((r, j) => {
      // Só com keywords: sem elas (fábrica), as palavras de conteúdo de "A roll of honey" casariam com
      // "honey roll", que está certo.
      if (!r.flawed || !r.recast || r.recast.local || !r.keywords?.length) return;
      const score = scoreReply(r, words, lang, "exact");
      if (score > top) {
        top = score;
        best = recastOf(r, node.id, j) as Extract<NaturalWay, { kind: "recast" }>;
      }
    });
  }
  return best;
}

/** O jeito natural da frase própria do fecho: o erro previsto, o modelo mais próximo, ou "natural". */
export function closingModel(mission: Mission, said: string): NaturalWay {
  const recast = closingRecast(mission, said);
  if (recast) return recast;
  const model = closestModel(mission, said);
  return containsWords(said, model.text, mission.target) ? { kind: "natural" } : modelOf(model);
}
