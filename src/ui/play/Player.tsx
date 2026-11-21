// O player de uma missão (W2-08): escuta → falas → reação → fecho → fim. A lógica é a máquina de estados do motor
// (`step`); aqui só se mostra, se fala e se guarda a sessão a cada passo. A rodada em andamento volta de onde estava.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { VOICE_LANGS, type VoiceLang } from "../../services/voice";
import { holdUpdates } from "../../services/appUpdate";
import { finishRun, keepSession, speak, startRun, stopSpeaking, xpOfStep, type Mode, type Prepared, type PlayState, type Voice } from "../../services/play";
import { step, type Input, type Outcome } from "../../engine";
import { closestModel, type Mission } from "../../schemas";
import { PageTitle } from "../PageTitle";
import type { Art } from "../art/sprites";
import { npcView } from "../world";
import { AnswerInput } from "./AnswerInput";
import { Bubble } from "./Bubble";
import { Intro } from "./Intro";
import { splitRecast } from "../recast";
import { useT } from "../useT";

const isVoiceLang = (value: string): value is VoiceLang => (VOICE_LANGS as readonly string[]).includes(value);

interface Line {
  text: string;
  translation?: string | undefined;
  /** `Character.id` de quem fala. */
  who: string;
}

type Notice = { kind: "retry"; line: Line; raised: boolean };

export function Player({ prepared }: { prepared: Prepared }) {
  const t = useT();
  const { mission, voices, npcs, today } = prepared;
  const navigate = useNavigate();
  const [state, setState] = useState<PlayState | null>(null);
  const [mode, setMode] = useState<Mode>(prepared.suggested);
  const [asking, setAsking] = useState(prepared.resume !== null); // "continuar ou recomeçar?"
  const [notice, setNotice] = useState<Notice | null>(null);
  const [said, setSaid] = useState("");
  const [tried, setTried] = useState(""); // a última frase tentada no fecho: escolhe o modelo mais próximo
  const [saved, setSaved] = useState<string | "error" | null>(null); // id da rodada gravada; null = gravando
  const finishing = useRef(false);

  // Missão aberta: nada de recarregar o app no meio (W2-10). Ao sair, para a fala.
  useEffect(() => {
    const release = holdUpdates();
    return () => {
      release();
      stopSpeaking();
    };
  }, []);

  const speaker = (who: string): Voice => voices[who] ?? Object.values(voices)[0]!;
  const nameOf = (who: string): string => mission.characters.find((c) => c.id === who)?.name ?? who;
  const artOf = (who: string) => {
    const id = mission.characters.find((c) => c.id === who)?.npc;
    return id === undefined ? undefined : npcView(id)?.art;
  };
  const say = (line: Line) => {
    stopSpeaking();
    void speak(line.text, speaker(line.who));
  };
  const lang = (who: string): string => speaker(who).lang;
  const base = mission.base;
  /** Quem faz a pergunta do fecho e pede para repetir: a primeira personagem com ficha de NPC. */
  const host = mission.characters.find((c) => npcs[c.id])?.id ?? mission.characters[0]!.id;
  const model = closestModel(mission, tried);

  const retryLine = (who: string, fallback: Line): Line => {
    const line = npcs[who]?.lines[mission.target]?.retry ?? npcs[host]?.lines[mission.target]?.retry;
    return line ? { text: line.text, translation: line.translation?.[base], who: npcs[who] ? who : host } : fallback;
  };

  function begin(chosen: Mode) {
    const next = startRun(prepared, chosen);
    setState(next);
    setAsking(false);
    const first = lineAt(mission, next, host);
    if (first) say(first);
  }

  function resume() {
    const next = prepared.resume!;
    setState(next);
    setAsking(false);
    const line = lineAt(mission, next, host);
    if (line) say(line);
  }

  function apply(input: Input, utterances: readonly string[] = []) {
    if (!state) return;
    if (state.phase === "closing" && input.type === "say") setTried(utterances[0] ?? "");
    const { state: next, outcome } = step(mission, state, input);
    if (outcome.kind === "none" && next === state) return;
    setState(next);
    void keepSession(next);
    setNotice(null);
    handle(state, next, outcome, input, utterances);
  }

  function handle(before: PlayState, after: PlayState, outcome: Outcome, input: Input, utterances: readonly string[]) {
    const node = mission.nodes.find((n) => n.id === before.node)!;
    if (outcome.kind === "matched") {
      const reply = node.replies[outcome.reply]!;
      setSaid(input.type === "tap" ? reply.text : (utterances[outcome.alternative] ?? reply.text));
      if (reply.reaction) say({ text: reply.reaction.text, who: node.speaker });
      return;
    }
    if (outcome.kind === "retry") {
      const line = retryLine(node.speaker, { text: node.text, translation: node.translation, who: node.speaker });
      setNotice({ kind: "retry", line, raised: outcome.raised });
      say(line);
      return;
    }
    if (outcome.kind === "closing_retry") {
      const line = retryLine(host, { text: mission.closing.question.text, translation: mission.closing.question.translation, who: host });
      setNotice({ kind: "retry", line, raised: false });
      say(line);
      return;
    }
    if (after.phase === "done") {
      say({ text: mission.closing.success.text, translation: mission.closing.success.translation, who: host });
      return;
    }
    if (input.type === "help") return;
    if (after.phase !== before.phase || after.node !== before.node || after.listen !== before.listen) {
      const line = lineAt(mission, after, host, input.type === "say" ? (utterances[0] ?? tried) : tried);
      if (line) say(line);
    }
  }

  // Fim da rodada: grava (idempotente) e libera o relatório. Falha de gravação: tentar de novo, a rodada não se perde.
  const finish = (finalState: PlayState) => {
    finishRun(mission, finalState).then(
      ({ runId }) => setSaved(runId),
      () => setSaved("error"),
    );
  };
  const done = state?.phase === "done";
  useEffect(() => {
    if (done && state && !finishing.current) {
      finishing.current = true;
      finish(state);
    }
    // `finish` só depende de `mission`, estável nesta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (state === null) {
    return (
      <Intro
        prepared={prepared}
        mode={mode}
        onMode={setMode}
        resumable={asking}
        onResume={resume}
        onRestart={() => setAsking(false)}
        onStart={() => begin(mode)}
      />
    );
  }

  const node = mission.nodes.find((n) => n.id === state.node)!;
  const total = mission.nodes.length;
  const voiceLang = isVoiceLang(mission.target) ? mission.target : null;
  const textLang = voices[host] ? lang(host) : "en-US";

  return (
    <>
      <PageTitle>{mission.title}</PageTitle>
      <p className="hint">
        <Link to={`/place/${mission.location}`}>{t("play.back")}</Link>
      </p>
      {state.phase !== "listen" && state.phase !== "done" && (
        <>
          <progress className="xp" aria-hidden="true" value={state.phase === "closing" || state.phase === "model" ? total : state.steps.length} max={total} />
          {(state.phase === "ask" || state.phase === "react") && <p className="hint">{t("play.progress", { n: Math.min(state.steps.length + (state.phase === "ask" ? 1 : 0), total), total })}</p>}
        </>
      )}

      {state.phase === "listen" && (
        <section aria-labelledby="play-step">
          <h2 id="play-step">{t("play.listen.title")}</h2>
          <p className="hint">{t("play.listen.hint")}</p>
          <div className="dialogue" aria-live="polite">
            {mission.listen.slice(0, state.listen + 1).map((line, index) => (
              <Bubble
                key={index}
                name={nameOf(line.speaker)}
                text={line.text}
                lang={lang(line.speaker)}
                translation={line.translation}
                art={artOf(line.speaker)}
                onReplay={() => say({ text: line.text, who: line.speaker })}
              />
            ))}
          </div>
          <Continue
            key={`l${state.listen}`}
            label={state.listen + 1 >= mission.listen.length ? t("play.listen.last") : t("play.listen.continue")}
            onClick={() => apply({ type: "next" })}
          />
        </section>
      )}

      {state.phase === "ask" && (
        <section aria-labelledby="play-step">
          <h2 id="play-step" className="sr-only">
            {t("play.progress", { n: state.steps.length + 1, total })}
          </h2>
          <div className="dialogue" aria-live="polite">
            <Bubble
              key={node.id}
              name={nameOf(node.speaker)}
              text={node.text}
              lang={lang(node.speaker)}
              translation={node.translation}
              art={artOf(node.speaker)}
              onReplay={() => say({ text: node.text, who: node.speaker })}
            />
            {notice && (
              <Bubble
                key={`n${state.retries}`}
                name={nameOf(notice.line.who)}
                text={notice.line.text}
                lang={lang(notice.line.who)}
                translation={notice.line.translation}
                art={artOf(notice.line.who)}
              />
            )}
            {notice?.raised && <p className="notice">{t("play.help.raised")}</p>}
          </div>
          <Help node={node} help={state.help} onTap={(reply) => apply({ type: "tap", reply })} onHelp={() => apply({ type: "help" })} lang={lang(host)} />
          <AnswerInput key={node.id} voiceLang={voiceLang} textLang={textLang} onSay={(input, utterances) => apply({ type: "say", input, utterances }, utterances)} />
        </section>
      )}

      {state.phase === "react" && <ReactStep mission={mission} state={state} said={said} xp={xpOfStep(state.steps[state.steps.length - 1]!, today)} nameOf={nameOf} artOf={artOf} lang={lang} onContinue={() => apply({ type: "next" })} />}

      {(state.phase === "closing" || state.phase === "model") && (
        <section aria-labelledby="play-step">
          <h2 id="play-step">{state.phase === "closing" ? t("play.closing.title") : t("play.model.title")}</h2>
          <div className="dialogue" aria-live="polite">
            {state.phase === "closing" ? (
              <Bubble
                name={nameOf(host)}
                text={mission.closing.question.text}
                lang={lang(host)}
                translation={mission.closing.question.translation}
                art={artOf(host)}
                onReplay={() => say({ text: mission.closing.question.text, who: host })}
              />
            ) : (
              <Bubble
                tone="model"
                name={t("play.you")}
                text={model.text}
                lang={lang(host)}
                translation={model.translation}
                onReplay={() => say({ text: model.text, who: host })}
              />
            )}
            {notice && (
              <Bubble key={`n${state.retries}`} name={nameOf(notice.line.who)} text={notice.line.text} lang={lang(notice.line.who)} translation={notice.line.translation} art={artOf(notice.line.who)} />
            )}
          </div>
          {state.phase === "closing" && state.fails >= 1 && <p className="notice">{t("play.closing.hint", { hint: mission.closing.hint })}</p>}
          {state.phase === "model" && <p className="hint">{t("play.model.text")}</p>}
          <AnswerInput key={state.phase} voiceLang={voiceLang} textLang={textLang} onSay={(input, utterances) => apply({ type: "say", input, utterances }, utterances)} />
          {state.phase === "model" && (
            <p>
              <button type="button" className="btn" onClick={() => apply({ type: "skip" })}>
                {t("play.model.skip")}
              </button>
            </p>
          )}
        </section>
      )}

      {state.phase === "done" && (
        <section aria-labelledby="play-step">
          <h2 id="play-step" className="sr-only">
            {t("play.done.report")}
          </h2>
          <div className="dialogue" aria-live="polite">
            <Bubble
              name={nameOf(host)}
              text={mission.closing.success.text}
              lang={lang(host)}
              translation={mission.closing.success.translation}
              art={artOf(host)}
              onReplay={() => say({ text: mission.closing.success.text, who: host })}
            />
          </div>
          <div role="status">
            {saved === null && <p className="hint">{t("play.done.saving")}</p>}
            {saved === "error" && <p className="notice notice-error">{t("play.done.error")}</p>}
          </div>
          {saved === "error" && (
            <p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSaved(null);
                  finish(state);
                }}
              >
                {t("play.done.retry")}
              </button>
            </p>
          )}
          {saved !== null && saved !== "error" && (
            <Continue key="report" label={t("play.done.report")} onClick={() => navigate(`/report/${saved}`, { state: { fresh: true } })} />
          )}
        </section>
      )}
    </>
  );
}

/** A fala que se diz ao entrar neste ponto da rodada (`null` quando não há uma). */
export function lineAt(mission: Mission, state: PlayState, host: string, tried = ""): Line | null {
  if (state.phase === "listen") {
    const line = mission.listen[state.listen];
    return line ? { text: line.text, translation: line.translation, who: line.speaker } : null;
  }
  if (state.phase === "ask") {
    const node = mission.nodes.find((n) => n.id === state.node);
    return node ? { text: node.text, translation: node.translation, who: node.speaker } : null;
  }
  if (state.phase === "closing") return { text: mission.closing.question.text, translation: mission.closing.question.translation, who: host };
  if (state.phase === "model") {
    const model = closestModel(mission, tried);
    return { text: model.text, translation: model.translation, who: host };
  }
  return null;
}

/** Botão de seguir: o foco vai para ele a cada passo (o componente é remontado com `key`). */
function Continue({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <p className="continue">
      <button type="button" autoFocus className="btn btn-primary btn-big" onClick={onClick}>
        {label}
      </button>
    </p>
  );
}

// ---------- Ajuda (livre: ideia → frase → tocar) ----------

const HELP_LABEL = { 0: "play.help.idea", 1: "play.help.phrase", 2: "play.help.tap" } as const;

function Help({
  node,
  help,
  lang,
  onHelp,
  onTap,
}: {
  node: Mission["nodes"][number];
  help: 0 | 1 | 2 | 3;
  lang: string;
  onHelp: () => void;
  onTap: (reply: number) => void;
}) {
  const t = useT();
  return (
    <div className="help">
      {help === 1 && (
        <section aria-labelledby="help-title">
          <h3 id="help-title">{t("play.help.idea_title")}</h3>
          <ul className="help-list">
            {node.replies.map((reply, index) => (
              <li key={index}>{reply.translation}</li>
            ))}
          </ul>
        </section>
      )}
      {help === 2 && (
        <section aria-labelledby="help-title">
          <h3 id="help-title">{t("play.help.phrase_title")}</h3>
          <ul className="help-list">
            {node.replies.map((reply, index) => (
              <li key={index}>
                <span lang={lang} className="help-phrase">
                  {reply.text}
                </span>
                <span className="hint">{reply.translation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {help === 3 && (
        <section aria-labelledby="help-title">
          <h3 id="help-title">{t("play.help.tap_title")}</h3>
          <ul className="help-list help-taps">
            {node.replies.map((reply, index) => (
              <li key={index}>
                <button type="button" className="btn tap-option" onClick={() => onTap(index)}>
                  <span lang={lang} className="help-phrase">
                    {reply.text}
                  </span>
                  <span className="hint">{reply.translation}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {help !== 3 && (
        <p>
          <button type="button" className="btn" onClick={onHelp}>
            {t(HELP_LABEL[help])}
          </button>
        </p>
      )}
    </div>
  );
}

// ---------- Reação: o recast destacado como texto ----------

function ReactStep({
  mission,
  state,
  said,
  xp,
  nameOf,
  artOf,
  lang,
  onContinue,
}: {
  mission: Mission;
  state: PlayState;
  said: string;
  xp: number;
  nameOf: (who: string) => string;
  artOf: (who: string) => Art | undefined;
  lang: (who: string) => string;
  onContinue: () => void;
}) {
  const t = useT();
  const last = state.steps[state.steps.length - 1]!;
  const node = mission.nodes.find((n) => n.id === last.node)!;
  const reply = node.replies[last.reply]!;
  const reaction = reply.reaction;
  const parts = reaction && reply.recast ? splitRecast(reaction.text, reply.recast.corrected) : null;
  return (
    <section aria-labelledby="play-step">
      <h2 id="play-step" className="sr-only">
        {t("play.you_said")}
      </h2>
      <div className="dialogue" aria-live="polite">
        <Bubble tone="me" name={t("play.you_said")} text={said === "" ? reply.text : said} lang={lang(node.speaker)} />
        {reaction && (
          <Bubble name={nameOf(node.speaker)} text={reaction.text} lang={lang(node.speaker)} translation={reaction.translation} art={artOf(node.speaker)}>
            {parts && parts.match !== "" ? (
              <>
                {parts.before}
                <mark className="recast">{parts.match}</mark>
                {parts.after}
              </>
            ) : undefined}
          </Bubble>
        )}
        <p className="xp-chip">{t("play.xp", { n: xp })}</p>
      </div>
      <Continue key={`r${state.steps.length}`} label={t("play.continue")} onClick={onContinue} />
    </section>
  );
}
