// i18n sem biblioteca (W0-03 §2.4). Puro: sem React (o hook e o seletor ficam em ui/).
// Textos em /i18n/*.json. Chaves tipadas a partir do pt-BR; plural por Intl.PluralRules; nenhum HTML nas traduções.
import ptBR from "../../i18n/pt-BR.json";
import en from "../../i18n/en.json";

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type MessageKey = keyof typeof ptBR;

/** Texto simples ou plural: `{ "one": "...", "other": "..." }` (categorias de Intl.PluralRules). */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralForms;
export type Params = Readonly<Record<string, string | number>>;

// O tipo Record<MessageKey, Message> faz o en.json sem uma chave não compilar.
const MESSAGES: Record<Locale, Record<MessageKey, Message>> = { "pt-BR": ptBR, en };

export const DEFAULT_LOCALE: Locale = "en";
export const STORAGE_KEY = "glifora.ui-lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Detecção por `navigator.languages`: o primeiro idioma da lista que a interface tem.
 * `pt*` (pt, pt-PT, pt-BR) → pt-BR; `en*` → en; qualquer outro é pulado; sem nenhum → en.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split("-")[0];
    if (primary === "pt") return "pt-BR";
    if (primary === "en") return "en";
  }
  return DEFAULT_LOCALE;
}

/** Traduz sem estado: `translate("pt-BR", "mission.xp", { n: 12 })`. */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return render(locale, MESSAGES[locale][key], params);
}

/** Escolhe a forma do plural (por `n`) e troca os `{marcadores}`. Exportada para teste. */
export function render(locale: Locale, message: Message, params?: Params): string {
  const template = typeof message === "string" ? message : pickPlural(locale, message, params?.["n"]);
  return interpolate(locale, template, params);
}

function pickPlural(locale: Locale, forms: PluralForms, n: string | number | undefined): string {
  const count = typeof n === "number" ? n : Number(n);
  if (n === undefined || Number.isNaN(count)) return forms.other;
  return forms[new Intl.PluralRules(locale).select(count)] ?? forms.other;
}

function interpolate(locale: Locale, template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    // hasOwn: "{constructor}" e afins não podem ler a cadeia de protótipos.
    if (!Object.hasOwn(params, name)) return placeholder;
    const value = params[name];
    if (value === undefined) return placeholder;
    return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : value;
  });
}

// ---------- Idioma atual (estado do módulo; a UI assina com useSyncExternalStore) ----------

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function readStored(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null; // localStorage bloqueado ou ausente: o app segue sem persistir
  }
}

function applyToDocument(locale: Locale): void {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

/**
 * Chamar uma vez no boot, antes da primeira tela. Síncrono: o idioma salvo (ou o detectado) já vale
 * na primeira pintura, sem piscar no idioma errado. Não grava: só a escolha explícita do jogador persiste.
 */
export function initLocale(languages: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages): Locale {
  current = readStored() ?? detectLocale(languages);
  applyToDocument(current);
  return current;
}

export function getLocale(): Locale {
  return current;
}

/** Troca na hora, persiste e atualiza <html lang>. */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // sem persistência; a troca vale nesta sessão
  }
  applyToDocument(locale);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Traduz no idioma atual. Em componentes, use o hook `useT()` (ui/), que re-renderiza na troca. */
export function t(key: MessageKey, params?: Params): string {
  return translate(current, key, params);
}
