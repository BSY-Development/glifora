// Valida todo o conteúdo de content/ e gera src/catalog/generated/index.json (W0-03 §5.3, W2-04).
//   node scripts/content/build-index.ts
// Roda em predev, prebuild e pretest. Sai com código 1 e a lista de problemas se algo não passar.
// Lê content/world, npcs, patterns, missions e eval/stt (D-48); o resto de eval/ não entra.
import { mkdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// src/schemas/ usa imports sem extensão (o Vite resolve). No Node, um gancho tenta "<caminho>.ts".
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { buildContent, formatIssues, readContentDir } = await import("./lib.ts");

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = readContentDir(join(root, "content"));
const built = buildContent(read.files);
const all = [...read.issues, ...built.issues];

if (all.length > 0) {
  console.error(`Conteúdo com problemas (${all.length}):\n${formatIssues(all)}`);
  process.exit(1);
}

const out = join(root, "src", "catalog", "generated", "index.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(built.index, null, 2)}\n`);
console.log(`Conteúdo válido: ${built.index.missions.length} missões no índice (${relative(root, out).split(sep).join("/")}).`);
