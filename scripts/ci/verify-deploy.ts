// Conferência pós-deploy (W1-13): busca a URL real e exige (1) os cabeçalhos do bloco `/*` do _headers com o valor exato,
// (2) /version.json com o commit desta rodada, (3) uma rota profunda caindo no app (fallback de SPA) e
// (4) /sw.js (JavaScript, sem cache, cabeçalhos do /*) e /manifest.webmanifest (W1-12).
// Tenta de novo por até ~3 minutos (propagação) e falha alto, mostrando a diferença.
// Uso: DEPLOY_URL=https://glifora.pages.dev EXPECTED_COMMIT=<sha> node scripts/ci/verify-deploy.ts
import { readFileSync } from "node:fs";
import { checkVersion, compareHeaders, describeMismatches } from "./verifyDeploy.ts";

const base = (process.env["DEPLOY_URL"] ?? "").replace(/\/$/, "");
const sha = process.env["EXPECTED_COMMIT"] ?? process.env["GITHUB_SHA"] ?? "";
if (!/^https:\/\//.test(base) || !/^[0-9a-f]{7,40}$/i.test(sha)) {
  console.error("Defina DEPLOY_URL (https://...) e EXPECTED_COMMIT (sha do commit).");
  process.exit(2);
}
const expectedCommit = sha.slice(0, 7).toLowerCase(); // o mesmo formato do /about e do version.json
const headersFile = readFileSync("public/_headers", "utf8");
const DEADLINE = Date.now() + 3 * 60 * 1000;
const WAIT_MS = 10_000;

async function get(path: string): Promise<Response> {
  return fetch(`${base}${path}`, { cache: "no-store", redirect: "manual", headers: { "cache-control": "no-cache" } });
}

/** Uma rodada de conferência. Devolve os problemas (vazio = tudo certo). */
async function attempt(): Promise<string[]> {
  const problems: string[] = [];

  const home = await get("/");
  if (home.status !== 200) problems.push(`GET / respondeu ${home.status}`);
  const mismatches = compareHeaders(headersFile, home.headers);
  if (mismatches.length > 0) problems.push(`Cabeçalhos de / diferentes do public/_headers:\n${describeMismatches(mismatches)}`);

  const version = await get("/version.json");
  if (version.status !== 200) problems.push(`GET /version.json respondeu ${version.status}`);
  else {
    try {
      const issue = checkVersion(await version.json(), expectedCommit);
      if (issue) problems.push(issue);
    } catch {
      problems.push("/version.json não é JSON");
    }
    if (!/no-cache/i.test(version.headers.get("cache-control") ?? "")) {
      problems.push(`/version.json sem Cache-Control: no-cache (recebido: ${version.headers.get("cache-control") ?? "(ausente)"})`);
    }
  }

  // Rota profunda: abrir /settings direto tem de entregar o app, não um 404 do Cloudflare.
  const deep = await get("/settings");
  if (deep.status !== 200) {
    problems.push(`GET /settings respondeu ${deep.status} (esperado 200, fallback de SPA)`);
  } else {
    if (!(await deep.text()).includes('id="root"')) problems.push("GET /settings não devolveu o index.html do app");
    const deepMismatches = compareHeaders(headersFile, deep.headers);
    if (deepMismatches.length > 0) problems.push(`Cabeçalhos de /settings diferentes do public/_headers:\n${describeMismatches(deepMismatches)}`);
  }

  return problems;
}

for (let n = 1; ; n += 1) {
  let last: string[];
  try {
    last = await attempt();
  } catch (error) {
    last = [`falha de rede: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (last.length === 0) {
    console.log(`OK: ${base} serve os cabeçalhos do _headers, o commit ${expectedCommit} o fallback de SPA, o /sw.js e o manifesto (tentativa ${n}).`);
    break;
  }
  if (Date.now() + WAIT_MS > DEADLINE) {
    console.error(`FALHOU depois de ${n} tentativas em ${base}:\n- ${last.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Tentativa ${n}: ainda não (${last.length} problema(s)); nova tentativa em ${WAIT_MS / 1000}s.`);
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
}
