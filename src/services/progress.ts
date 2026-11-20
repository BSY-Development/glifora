// Progresso do jogador: XP, nível, título, ofensiva e desbloqueios, derivados do livro-razão (W0-03 §4.1).
// A tela lê com `useLiveQuery(() => loadProgress())` e reage sozinha a qualquer evento novo.
import { localDay, listEvents } from "../data";
import { deriveProgress, rulesV1, type Progress } from "../engine";
import { getDb, getDeps } from "./storage";

export type { Progress, TitleId } from "../engine";

export async function loadProgress(): Promise<Progress> {
  const events = await listEvents(getDb());
  return deriveProgress(events, rulesV1, localDay(getDeps().now()));
}
