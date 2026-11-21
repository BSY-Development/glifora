// O aviso de problema com a IA (D-56): o que houve e o que fazer, em texto puro. Nunca traz a key. Só o erro desconhecido
// ganha a linha "Detalhe" com a mensagem do Google (limpa, até 200 caracteres, sem a key).
import type { AiProblem } from "../services/ai";
import { useQuoted } from "./Quoted";
import { useT } from "./useT";

export function AiProblemNotice({ problem, detail, id }: { problem: AiProblem; detail?: string | undefined; id?: string }) {
  const t = useT();
  const quoted = useQuoted();
  return (
    <div className="notice notice-error" role="alert" id={id}>
      <p>
        <strong>{t(`ai.problem.${problem}`)}</strong>
      </p>
      <p>{t(`ai.problem.${problem}.fix`)}</p>
      {detail !== undefined && <p className="hint">{quoted("ai.problem.detail", { text: detail }, "en")}</p>}
    </div>
  );
}
