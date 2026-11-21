// A linha do relatório que explica a estrela da rodada. Os motivos vêm do motor (`degreeWhy`); aqui só viram frases.
import type { MessageKey, Params } from "../i18n";
import type { DegreeWhy } from "../engine";

type Translate = (key: MessageKey, params?: Params) => string;

/** "2", "2 e 4", "2, 3 e 4" (ou "and"), conforme o idioma da interface. */
function turnList(turns: readonly number[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(turns.map(String));
  } catch {
    return turns.join(", ");
  }
}

function limit(t: Translate, max: number): string {
  return max === 0 ? t("report.degree.limit.0") : max === 1 ? t("report.degree.limit.1") : t("report.degree.limit.n", { n: max });
}

/** Ex.: "Esta rodada valeu ★★. A ajuda apareceu nas falas 2 e 4. Para ★★★: de cor, com ajuda em no máximo 1 fala." */
export function degreeText(t: Translate, why: DegreeWhy, locale: string): string {
  const parts: string[] = [t(`report.degree.earned.${why.degree}`)];
  switch (why.reason) {
    case "done":
      break;
    case "empty":
      parts.push(t("report.degree.why.empty"));
      break;
    case "closing_none":
    case "closing_failed":
      parts.push(t(`report.degree.why.${why.reason}`), t("report.degree.goal.closing"));
      break;
    case "closing_model":
      parts.push(t("report.degree.why.closing_model"), t("report.degree.goal.closing_model"));
      break;
    case "taps":
      parts.push(t("report.degree.why.taps", { turns: turnList(why.turns, locale) }), t(`report.degree.goal.${why.next}`, { limit: limit(t, why.max) }));
      break;
    case "help":
      parts.push(t(why.next === 3 ? "report.degree.why.help3" : "report.degree.why.help2", { turns: turnList(why.turns, locale) }), t(`report.degree.goal.${why.next}`, { limit: limit(t, why.max) }));
      break;
  }
  return parts.join(" ");
}
