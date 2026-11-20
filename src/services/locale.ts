// Idioma da interface: o localStorage continua sendo a leitura síncrona do boot (W1-05);
// o doc `prefs` guarda o espelho, para ele entrar no exportar/importar e na sincronização.
import { getLocale, getStoredLocale, setLocale, subscribe } from "../i18n";
import { readPrefsState, updatePrefs } from "./player";

let mirroring = false;

/**
 * No boot, depois de abrir o banco:
 *  - nunca escolheu aqui e as preferências têm um idioma (aparelho novo, dados importados) → vale o das preferências;
 *  - escolheu aqui e as preferências divergem → vale o que a pessoa já está vendo, e o espelho é corrigido.
 * Preferências de versão mais nova, estragadas ou qualquer falha: não espelha e não derruba o boot.
 */
export async function syncLocaleOnBoot(): Promise<void> {
  try {
    const prefs = await readPrefsState();
    if (prefs === null) return;
    const stored = getStoredLocale();
    if (stored === null) {
      if (prefs.uiLang !== null) setLocale(prefs.uiLang);
    } else if (prefs.uiLang !== stored) {
      await updatePrefs({ uiLang: stored });
    }
  } catch {
    // o idioma já está valendo pelo localStorage; o espelho tenta de novo no próximo boot
  }
}

/** Depois de importar: o idioma das preferências recém-chegadas passa a valer na hora (se der para ler). */
export async function applyPrefsLocale(): Promise<void> {
  try {
    const prefs = await readPrefsState();
    if (prefs?.uiLang) setLocale(prefs.uiLang);
  } catch {
    // sem espelho legível: fica o idioma atual
  }
}

/** Cada troca de idioma feita na interface vai para o doc `prefs`. Chamar uma vez. */
export function startLocaleMirror(): void {
  if (mirroring) return;
  mirroring = true;
  subscribe(() => {
    // Falhar em espelhar não pode atrapalhar a troca: o localStorage já guardou, e o boot corrige depois.
    updatePrefs({ uiLang: getLocale() }).catch(() => undefined);
  });
}
