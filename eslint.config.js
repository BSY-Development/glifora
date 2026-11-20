// ESLint do Glifora.
// Fronteiras entre camadas de src/: D-41 e docs/propostas/W0-03-arquitetura.md §2.1.
// Segurança: nada de eval, de HTML vindo de dado, de rede fora de ai/ e data/, nem de texto de interface fora do i18n.
//
// Cada camada recebe UM bloco com todas as regras restritivas, porque no ESLint um bloco posterior substitui a regra
// inteira (não soma). Os padrões de importação valem igual para `import ... from` e para `import()` dinâmico.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const LAYERS = ["schemas", "engine", "data", "catalog", "speech", "ai", "i18n", "services", "ui"];
const PURE = new Set(["schemas", "engine"]); // sem relógio, sorteio, rede ou APIs do navegador
const NETWORK_OK = new Set(["ai", "data"]); // só aqui pode haver chamada de rede (provedores de IA; sincronização na fase 5)
const REACT = ["react", "react-dom", "react-router", "dexie-react-hooks"];
const MSG = "Fronteira entre camadas (D-41, W0-03 §2.1): esta pasta não pode importar daí.";

// ---------- Padrões de importação (regex sobre o texto do import) ----------
// Sem escapar "-" nem "/": o ESLint compila os padrões com a flag u, que recusa escape desnecessário.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const P = {
  layers: (names) => ({ regex: `^(\\.\\./)+(${names.join("|")})(/|$)`, message: MSG }),
  packages: (names, why) => ({ regex: `^(${names.map(esc).join("|")})(/|$)`, message: `${MSG} ${why}` }),
  anyPackage: { regex: "^[^./]", message: `${MSG} Esta camada não usa pacotes.` },
  onlyZod: { regex: "^(?!zod(/|$))[^./]", message: `${MSG} schemas/ só usa zod.` },
};
/** Caminhos que dariam a volta na regra: absoluto, via src/, "./../x" e "x/../y". */
const PATH_TRICKS = [
  { regex: "^/", message: "Sem importação por caminho absoluto: use caminho relativo (D-41)." },
  { regex: "(^|/)src(/|$)", message: "Sem importação via src/: use caminho relativo (D-41)." },
  { regex: "^\\./\\.\\.(/|$)", message: "Escreva '../x', não './../x' (D-41)." },
  { regex: "[^./]/\\.\\.(/|$)", message: "Sem 'pasta/../' no meio do caminho (D-41)." },
];

/** O mesmo padrão como seletor de `import()` dinâmico ("/" vira \x2F, exigido pelo esquery). */
const dynamicImport = ({ regex, message }) => ({
  selector: `ImportExpression[source.value=/${regex.replaceAll("/", "\\x2F")}/]`,
  message,
});

// ---------- Seletores de sintaxe ----------
const TEXT_ATTRS = "aria-label|aria-description|aria-placeholder|aria-roledescription|aria-valuetext|alt|title|placeholder|label";
const LETTER = "/\\p{L}/u";
const I18N_MSG = "Texto de interface vem do i18n (t('chave')), nunca solto no código. Vale também para rótulos de acessibilidade.";
const I18N_LITERALS = [
  `JSXText[value=${LETTER}]`,
  `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > Literal[value=${LETTER}]`,
  `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > Literal[value=${LETTER}]`,
  `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ConditionalExpression > ConditionalExpression > Literal[value=${LETTER}]`,
  `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=${LETTER}]`,
  `JSXAttribute[name.name=/^(${TEXT_ATTRS})$/] > Literal[value=${LETTER}]`,
  `JSXAttribute[name.name=/^(${TEXT_ATTRS})$/] > JSXExpressionContainer > Literal[value=${LETTER}]`,
  `JSXAttribute[name.name=/^(${TEXT_ATTRS})$/] > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > Literal[value=${LETTER}]`,
  `JSXAttribute[name.name=/^(${TEXT_ATTRS})$/] > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=${LETTER}]`,
].map((selector) => ({ selector, message: I18N_MSG }));

const HTML_MSG = "Conteúdo é sempre texto puro: nada de HTML vindo de dado (SPEC; Trusted Types, D-41).";
const HTML_METHODS = "insertAdjacentHTML|setHTMLUnsafe|parseHTMLUnsafe|createContextualFragment|parseFromString";
const HTML_SINKS = [
  "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  "JSXAttribute[name.name=/^src[Dd]oc$/]",
  "MemberExpression[property.name=/^(innerHTML|outerHTML|srcdoc)$/]",
  "MemberExpression[computed=true][property.value=/^(innerHTML|outerHTML|srcdoc)$/]",
  `CallExpression[callee.property.name=/^(${HTML_METHODS})$/]`,
  `CallExpression[callee.computed=true][callee.property.value=/^(${HTML_METHODS})$/]`,
  "NewExpression[callee.name='DOMParser']",
].map((selector) => ({ selector, message: HTML_MSG }));

const DYNAMIC_SOURCE = {
  selector: "ImportExpression:not([source.type='Literal'])",
  message: "import() só com caminho literal: assim o lint confere a fronteira (D-41).",
};
const GLOB_OUTSIDE_CATALOG = {
  selector: "CallExpression[callee.object.type='MetaProperty'][callee.property.name=/^glob/]",
  message: "import.meta.glob só em src/catalog/ (W0-03 §2.1).",
};
const PURE_SYNTAX = [
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "O relógio entra por parâmetro (W0-03 §2.1)." },
  { selector: "CallExpression[callee.name='Date']", message: "O relógio entra por parâmetro (W0-03 §2.1)." },
];
const NETWORK_NAMES = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];
const NETWORK_SYNTAX = [
  {
    selector: `MemberExpression[object.name=/^(window|globalThis|self)$/][property.name=/^(${NETWORK_NAMES.join("|")})$/]`,
    message: "Rede só em src/ai/ e src/data/ (defesa contra vazamento, W0-03 §1.2 C).",
  },
];

// ---------- Globais e propriedades ----------
const PURE_GLOBALS = [
  "window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "indexedDB", "caches",
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker", "crypto", "performance",
  "globalThis", "self", "setTimeout", "setInterval", "requestAnimationFrame", "queueMicrotask", "open", "alert", "confirm", "prompt",
].map((name) => ({ name, message: "schemas/ e engine/ são puros: recebem isso por parâmetro (W0-03 §2.1)." }));
const NETWORK_GLOBALS = NETWORK_NAMES.map((name) => ({
  name,
  message: "Rede só em src/ai/ e src/data/ (defesa contra vazamento, W0-03 §1.2 C).",
}));
const BASE_PROPERTIES = [
  { object: "document", property: "write", message: "Nada de document.write." },
  { object: "document", property: "writeln", message: "Nada de document.writeln." },
];
const PURE_PROPERTIES = [
  { object: "Date", property: "now", message: "O relógio entra por parâmetro (W0-03 §2.1)." },
  { object: "Math", property: "random", message: "O sorteio entra por parâmetro (W0-03 §2.1)." },
];
const NETWORK_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: "Rede só em src/ai/ e src/data/ (W0-03 §1.2 C)." },
];

// ---------- Regras por camada ----------
/** O que cada camada não pode importar (além de PATH_TRICKS, que vale para todas). */
const IMPORTS = {
  schemas: [P.layers(LAYERS.filter((l) => l !== "schemas")), P.onlyZod],
  engine: [P.layers(LAYERS.filter((l) => !["engine", "schemas"].includes(l))), P.anyPackage],
  data: [P.layers(LAYERS.filter((l) => !["data", "schemas", "engine"].includes(l))), P.packages(REACT, "data/ não usa React.")],
  catalog: [P.layers(LAYERS.filter((l) => !["catalog", "schemas"].includes(l))), P.anyPackage],
  speech: [P.layers(LAYERS.filter((l) => l !== "speech")), P.anyPackage],
  ai: [P.layers(LAYERS.filter((l) => !["ai", "schemas"].includes(l))), P.packages([...REACT, "dexie"], "ai/ não usa React nem Dexie.")],
  i18n: [P.layers(LAYERS.filter((l) => l !== "i18n")), P.packages([...REACT, "dexie"], "i18n/ é puro; hooks ficam em ui/.")],
  services: [P.layers(["ui"]), P.packages(REACT, "services/ não usa React.")],
  // A interface fala com dados, catálogo, voz e IA só por services/ (a key nunca chega aqui).
  ui: [P.layers(["data", "catalog", "speech", "ai"]), P.packages(["dexie"], "ui/ lê dados por services/ e dexie-react-hooks.")],
};

/** O conteúdo de content/ só entra pelo catálogo, que valida (W0-03 §5.3). */
const CONTENT_OUTSIDE_CATALOG = { regex: "^(\\.\\./)+content(/|$)", message: "content/ só entra por src/catalog/, que valida (W0-03 §5.3)." };

function restrictions(layer) {
  const imports = [...(layer ? IMPORTS[layer] : []), ...PATH_TRICKS, ...(layer === "catalog" ? [] : [CONTENT_OUTSIDE_CATALOG])];
  const pure = layer !== null && PURE.has(layer);
  const network = layer !== null && NETWORK_OK.has(layer);
  return {
    "no-restricted-imports": ["error", { patterns: imports }],
    "no-restricted-syntax": [
      "error",
      ...HTML_SINKS,
      ...I18N_LITERALS,
      ...imports.map(dynamicImport),
      DYNAMIC_SOURCE,
      ...(layer === "catalog" ? [] : [GLOB_OUTSIDE_CATALOG]),
      ...(pure ? PURE_SYNTAX : []),
      ...(network || pure ? [] : NETWORK_SYNTAX),
    ],
    "no-restricted-globals": ["error", ...(pure ? PURE_GLOBALS : network ? [] : NETWORK_GLOBALS)],
    "no-restricted-properties": [
      "error",
      ...BASE_PROPERTIES,
      ...(pure ? PURE_PROPERTIES : []),
      ...(network ? [] : NETWORK_PROPERTIES),
    ],
  };
}

const TESTS = ["**/*.test.{ts,tsx}"];

export default defineConfig(
  { ignores: ["dist/", "coverage/", "node_modules/", "src/catalog/generated/", ".maestri/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
    },
  },
  // Arquivos da raiz de src/ (main.tsx, sw-register.ts): só as regras gerais.
  { files: ["src/*.{ts,tsx}"], ignores: TESTS, rules: restrictions(null) },
  // Uma camada, um bloco.
  ...LAYERS.map((layer) => ({ files: [`src/${layer}/**/*.{ts,tsx}`], ignores: TESTS, rules: restrictions(layer) })),
  // Testes ao lado do código: podem ter texto literal e montar dados de várias camadas, mas nunca injetar HTML.
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", ...HTML_SINKS], "no-restricted-properties": ["error", ...BASE_PROPERTIES] },
  },
  // Testes, configs e scripts rodam no Node.
  {
    files: [...TESTS, "tests/**/*.ts", "scripts/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
);
