// O relatório inteiro em texto simples (D-55), para colar numa conversa. Mesmos dados e mesmos textos da tela.
// Tudo passa por `clean`: sem `<`, `>`, controle, bidi nem invisíveis (o conteúdo vem de missões e do que a pessoa disse).
import type { MessageKey, Params } from "../i18n";
import type { Report } from "../services/play";

type Translate = (key: MessageKey, params?: Params) => string;

const UNSAFE = /[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Uma linha de texto limpa: sem caracteres que enganam ou quebram a colagem. */
export function clean(text: string): string {
  return text.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
}

export function reportText(report: Report, t: Translate): string {
  const { run, mission, stars, conversationXp, prizeXp, after, lines, closingWay } = report;
  const out: string[] = [t("report.copy.header"), t("report.copy.mission", { title: clean(mission.title) }), clean(run.canDo ? t("report.cando.yes") : t("report.cando.no"))];
  out.push(clean(mission.can_do));
  out.push(t("report.stars", { n: stars }));
  out.push(t("report.xp.total", { n: conversationXp + prizeXp }));
  out.push(t("report.level", { n: after.level, title: t(`hud.title.${after.title}`) }));

  if (lines.length > 0) {
    out.push("", t("report.said.title"));
    lines.forEach((line, i) => {
      out.push(`${i + 1}. ${t("report.said.you", { said: clean(line.said ?? "") })}`);
      if (line.way.kind === "recast") out.push(`   ${t("report.said.recast", { text: clean(line.way.text) })}`);
      if (line.way.kind === "model") out.push(`   ${t("report.said.model", { text: clean(line.way.text) })}`, `   ${clean(line.way.translation)}`);
    });
  }

  const closing = run.closing;
  if (closing) {
    out.push("", t("report.closing.title"));
    if (closing.input === "tap") {
      out.push(t("report.closing.tap"));
      out.push(t("report.said.model", { text: clean(mission.closing.model_answer.text) }), clean(mission.closing.model_answer.translation));
    } else {
      out.push(t("report.said.you", { said: clean(closing.text) }));
      if (closingWay?.kind === "recast") out.push(t("report.said.recast", { text: clean(closingWay.text) }));
      if (closingWay?.kind === "model") out.push(t("report.said.model", { text: clean(closingWay.text) }), clean(closingWay.translation));
    }
  }
  return out.join("\n");
}
