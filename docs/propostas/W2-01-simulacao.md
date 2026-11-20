# W2-01 — Script da simulação (Fable, 2026-11-20)

É o script que conferiu as guardas e gerou as tabelas de `docs/propostas/W2-01-regras.md` (D-49). Serve para refazer as tabelas se o portão da fase 2 pedir ajuste. Não é código de produção: as regras de verdade ficam em `src/engine/`.

**Como rodar:**
1. Copie o bloco abaixo para um arquivo fora de `src/`, por exemplo `w2-01-sim.mjs` (JavaScript puro, sem dependências).
2. Rode `node w2-01-sim.mjs` (Node 22 ou mais novo). Se salvar como `.ts`, `npx tsx w2-01-sim.ts` também serve.
3. Para testar um ajuste, mude os números do bloco "regras v1" (ou as hipóteses em `BASE` e `PROFILES`) e rode de novo. A saída traz as guardas, a curva, os prêmios de missão e os cenários A, A' e B.

O sorteio tem semente fixa: a mesma entrada dá sempre a mesma saída.

```js
// W2-01 — simulação e conferência das regras v1 (Fable, 2026-11-20). Não é código de produção.
// As tabelas e funções de "regras v1" têm de ficar iguais às de docs/propostas/W2-01-regras.md (D-49).

// ---------- regras v1 ----------
const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const REPLY = { voice: [16, 12, 8, 8], typed: [16, 12, 8, 8], tap: [4, 4, 4, 4] };
const tier = (r) => (r <= 0 ? 1 : r === 1 ? 0.5 : 0.25);
const FIRST = 24, STAR = [40, 56, 80];
const q = (level, kind) => ((3 + CEFR.indexOf(level) + 1) / 4) * (kind === "boss" ? 1.5 : 1);
const ACH = { S: [20, 10], M: [50, 25], L: [100, 50] };
const ACH_SIZE = { first_mission: "S", first_star3: "M", first_boss: "M", voice_50: "M", own_words_25: "M", recast_10: "S", spells_100: "L", all_npcs: "L", streak_7: "M", days_30: "L", comeback: "S", can_do_5: "M" };

export function xpFor(s) {
  switch (s.kind) {
    case "reply": return Math.ceil(REPLY[s.input][s.scaffold] * tier(s.repeat ?? 0));
    case "closing": {
      const base = s.input === "tap" ? 4 : s.accepted && !s.usedModelAnswer ? 24 : s.usedModelAnswer ? 12 : 0;
      return Math.ceil(base * tier(s.repeat ?? 0));
    }
    case "mission": return ((s.firstTime ? FIRST : 0) + (s.mastery >= 1 ? STAR[Math.min(s.mastery, 3) - 1] : 0)) * q(s.level, s.missionKind);
    case "spell": {
      const base = s.input === "tap" ? 2 : { ai: 16, local: 12, self: 8 }[s.gradedBy];
      const g = s.input !== "tap" && s.gradedBy !== "self" && s.grade === "again" ? 0.5 : 1;
      return Math.ceil(base * g * tier(s.repeat ?? 0));
    }
    case "daily_complete": return 40;
    case "achievement": return ACH[ACH_SIZE[s.id] ?? "S"][0];
  }
}
export function coinsFor(s) {
  switch (s.kind) {
    case "mission": return ((s.firstTime ? 5 : 0) + (s.mastery >= 1 ? [5, 10, 15][Math.min(s.mastery, 3) - 1] : 0)) * (s.missionKind === "boss" ? 2 : 1);
    case "daily_complete": return 10;
    case "achievement": return ACH[ACH_SIZE[s.id] ?? "S"][1];
    default: return 0;
  }
}
const total = (L) => 25 * L * (L - 1);
const TITLES = [[50, "legend"], [40, "sage"], [31, "scholar"], [23, "ambassador"], [16, "diplomat"], [10, "merchant"], [5, "traveler"], [1, "apprentice"]];
export function levelAt(xp) {
  let L = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 25)) / 2));
  while (total(L + 1) <= xp) L++;
  while (total(L) > xp) L--;
  return { level: L, into: xp - total(L), toNext: total(L + 1) - xp, title: TITLES.find(([min]) => L >= min)[1] };
}
const help = (r) => (r.input === "tap" ? 3 : Math.min(r.scaffold, 2));
export function runDegree(run) {
  const n = run.replies.length, need = n - Math.floor(n / 5);
  const c = (k) => run.replies.filter((r) => help(r) <= k).length;
  const produced = run.closing.input !== "tap";
  const own = produced && run.closing.accepted && !run.closing.usedModelAnswer;
  if (own && c(0) >= need) return 3;
  if (own && c(1) >= need) return 2;
  if (produced && c(2) >= need) return 1;
  return 0;
}
export function streak(activeDays, extraFreezes, today) {
  const DAY = 86400000, num = (d) => Date.parse(d + "T00:00:00Z") / DAY, str = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const days = [...new Set(activeDays)].filter((d) => d <= today).sort().map(num);
  const extra = [...new Set(extraFreezes)].sort().map(num);
  const CAP = 2, frozen = [];
  let cur = 0, best = 0, bank = 0, n = 0, prev = null, e = 0;
  const gifts = (until) => { while (e < extra.length && extra[e] <= until) { bank = Math.min(CAP, bank + 1); e++; } };
  for (const d of days) {
    gifts(d);
    const gap = prev === null ? 0 : d - prev - 1;
    if (prev === null || gap > bank) cur = 1;
    else { bank -= gap; for (let x = prev + 1; x < d; x++) frozen.push(str(x)); cur += 1; }
    n += 1; if (n % 2 === 0) bank = Math.min(CAP, bank + 1);
    best = Math.max(best, cur); prev = d;
  }
  if (prev === null) return { current: 0, best: 0, freezesLeft: 0, frozenDays: [] };
  const t = num(today); gifts(t);
  const tail = Math.max(0, t - prev - 1);            // hoje ainda não acabou: não conta
  if (tail > bank) cur = 0;
  else { bank -= tail; for (let x = prev + 1; x < t; x++) frozen.push(str(x)); }
  return { current: cur, best, freezesLeft: bank, frozenDays: frozen };
}

// ---------- conferência das guardas ----------
function guards() {
  const out = [];
  const ok = (name, cond) => out.push(`${cond ? "ok  " : "FALHA"} ${name}`);
  const inputs = ["voice", "typed", "tap"], bools = [false, true];
  let g1 = true, g2a = true, g2b = true, g3 = true, gRep = true, gAtt = true, gPos = true;
  for (const repeat of [0, 1, 2, 3, 9]) for (const flawed of bools) for (const attempt of [1, 2, 3, 7]) {
    for (const scaffold of [0, 1, 2, 3]) {
      const v = (input, extra = {}) => xpFor({ kind: "reply", input, scaffold, flawed, attempt, repeat, ...extra });
      for (const i of inputs) { g1 &&= v(i) >= 0 && coinsFor({ kind: "reply", input: i, scaffold, flawed, attempt, repeat }) >= 0; gPos &&= v(i) >= 1; }
      g2a &&= v("voice") > v("tap") && v("typed") > v("tap");
      for (const i of inputs) {
        if (scaffold > 0) g2b &&= xpFor({ kind: "reply", input: i, scaffold: scaffold - 1, flawed, attempt, repeat }) >= v(i);
        g3 &&= v(i) === xpFor({ kind: "reply", input: i, scaffold, flawed: !flawed, attempt, repeat });
        gAtt &&= v(i) === xpFor({ kind: "reply", input: i, scaffold, flawed, attempt: 1, repeat });
        gRep &&= xpFor({ kind: "reply", input: i, scaffold, flawed, attempt, repeat: repeat + 1 }) <= v(i);
      }
    }
  }
  ok("1  reply: xp e moedas >= 0", g1);
  ok("2a reply: voz e digitado > toque (mesmo degrau, mesma repetição)", g2a);
  ok("2b reply: menos ajuda nunca dá menos", g2b);
  ok("3  reply: flawed vale igual", g3);
  ok("   reply: tentativa não muda o XP", gAtt);
  ok("   reply: repetição nunca aumenta e nunca zera", gRep && gPos);
  let c1 = true, c2 = true;
  for (const repeat of [0, 1, 2, 5]) {
    const c = (input, accepted, usedModelAnswer) => xpFor({ kind: "closing", input, accepted, usedModelAnswer, repeat });
    for (const i of inputs) for (const a of bools) for (const m of bools) c1 &&= c(i, a, m) >= 0;
    for (const i of ["voice", "typed"]) c2 &&= c(i, true, false) >= c(i, true, true) && c(i, true, true) > c("tap", false, true) && c(i, false, true) > c("tap", false, true) && c(i, true, false) > c("tap", true, false);
  }
  ok("1  closing: >= 0", c1);
  ok("2  closing: própria >= modelo > toque", c2);
  let m1 = true, m2 = true, mInt = true;
  for (const level of CEFR) for (const missionKind of ["encounter", "boss"]) for (const firstTime of bools) for (const mastery of [0, 1, 2, 3]) {
    const s = { kind: "mission", missionKind, level, firstTime, mastery };
    m1 &&= xpFor(s) >= 0 && coinsFor(s) >= 0; mInt &&= Number.isInteger(xpFor(s)) && Number.isInteger(coinsFor(s));
    if (mastery > 0) m2 &&= xpFor(s) >= xpFor({ ...s, mastery: mastery - 1 }) && coinsFor(s) >= coinsFor({ ...s, mastery: mastery - 1 });
  }
  ok("1  mission: xp e moedas >= 0 e inteiros", m1 && mInt);
  ok("2  mission: degrau maior nunca dá menos", m2);
  let s1 = true, s2 = true;
  for (const repeat of [0, 1, 2, 5]) for (const grade of ["again", "hard", "good", "easy"]) for (const gradedBy of ["local", "self", "ai"]) {
    const v = (input) => xpFor({ kind: "spell", input, grade, gradedBy, repeat });
    s1 &&= v("tap") >= 1 && coinsFor({ kind: "spell", input: "tap", grade, gradedBy, repeat }) === 0;
    s2 &&= v("voice") > v("tap") && v("typed") > v("tap");
  }
  ok("1  spell: >= 1", s1); ok("2  spell: voz e digitado > toque", s2);
  ok("   spell self: a nota não muda o XP", ["again", "hard", "good", "easy"].every((g) => xpFor({ kind: "spell", input: "typed", grade: g, gradedBy: "self", repeat: 0 }) === 8));
  ok("   spell: hard = good = easy", ["local", "ai"].every((by) => new Set(["hard", "good", "easy"].map((g) => xpFor({ kind: "spell", input: "voice", grade: g, gradedBy: by, repeat: 0 }))).size === 1));
  // ofensiva
  const d = (n) => new Date(Date.UTC(2027, 0, n)).toISOString().slice(0, 10);
  const wk = []; for (let i = 1; i <= 56; i++) if ((i - 1) % 7 < 5) wk.push(d(i));
  const r1 = streak(wk, [], d(54));
  ok(`4  ofensiva 5 dias sim, 2 não, por 8 semanas: segue (${r1.current} dias, ${r1.frozenDays.length} congelados)`, r1.current === 40 && r1.frozenDays.length === 14);
  const r2 = streak([d(1), d(2), d(3), d(4), d(8)], [], d(8));
  ok(`4  3 dias parados quebram (atual ${r2.current}, melhor ${r2.best})`, r2.current === 1 && r2.best === 4);
  const r3 = streak([d(1), d(2)], [], d(3));
  ok("4  hoje ainda sem jogar não quebra nem gasta", r3.current === 2 && r3.freezesLeft === 1 && r3.frozenDays.length === 0);
  const r4 = streak([d(1), d(2), d(3), d(4)], [], d(8));
  ok(`4  pausa maior que o estoque: ofensiva volta a 0 e o estoque fica (${r4.current}, ${r4.freezesLeft})`, r4.current === 0 && r4.best === 4 && r4.freezesLeft === 2);
  const r5 = streak([d(1), d(2), d(3), d(4)], [], d(7));
  ok(`4  2 dias parados com 2 guardados: segue (${r5.current}, sobra ${r5.freezesLeft}, congelados ${r5.frozenDays.join()})`, r5.current === 4 && r5.freezesLeft === 0 && r5.frozenDays.length === 2);
  const a1 = [d(1), d(2), d(5), d(6), d(9)], a2 = [d(3), d(6), d(10)];
  const u1 = streak([...a1, ...a2], [], d(10)), u2 = streak([...a2, ...a1, ...a1], [], d(10));
  ok("   dois aparelhos: a união dá o mesmo resultado em qualquer ordem", JSON.stringify(u1) === JSON.stringify(u2));
  const alt = []; for (let i = 1; i <= 21; i += 2) alt.push(d(i));
  ok(`   dia sim, dia não: quebra (atual ${streak(alt, [], d(21)).current}, melhor ${streak(alt, [], d(21)).best})`, streak(alt, [], d(21)).best < 11);
  ok("   levelAt nas bordas", [0, 49, 50, 149, 150, 61249, 61250].map((x) => levelAt(x).level).join() === "1,1,2,2,3,49,50" && levelAt(50).into === 0 && levelAt(49).toNext === 1);
  return out;
}

// ---------- simulação ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const BASE = [
  { id: "m1", level: "A1", kind: "encounter", n: 6 }, { id: "m2", level: "A1", kind: "encounter", n: 6 }, { id: "m3", level: "A1", kind: "encounter", n: 6 },
  { id: "m4", level: "A2", kind: "encounter", n: 6 }, { id: "m5", level: "A2", kind: "boss", n: 8 },
];
const PROFILES = {
  toca: { input: "tap", runsA: 6, p1: 0, p0: 0, own: 0, encB: 3, bossB: true, extraB: 1, spellsB: 10, spellOk: 0 },
  digita: { input: "typed", runsA: 3, p1: 0.8, p0: 0.6, own: 0.9, encB: 2, bossB: true, extraB: 0, spellsB: 5, spellOk: 0.8 },
  fala: { input: "voice", runsA: 5, p1: 0.85, p0: 0.7, own: 0.95, encB: 3, bossB: true, extraB: 0, spellsB: 10, spellOk: 0.85 },
};

function play(profile, P, { scenario, sessions, sameDay = false, seed }) {
  const rand = rng(seed);
  const missions = BASE.map((m) => ({ ...m }));
  const st = new Map(); // id -> { mastery, runs, last }
  const S = (m) => st.get(m.id) ?? (st.set(m.id, { mastery: 0, runs: 0, last: -1, done: false }), st.get(m.id));
  let xp = 0, coins = 0, today = new Map(), newEnc = 0, newBoss = 0;
  const log = [];
  const runMission = (m, sIdx) => {
    const s = S(m), tap = P.input === "tap";
    const mode = m.kind === "boss" ? 3 : Math.min(s.mastery + 1, 3), start = 3 - mode, f = s.runs;
    const day = today.get(m.id) ?? (today.set(m.id, { nodes: Array.from({ length: m.n }, () => []), closing: [] }), today.get(m.id));
    const run = { replies: [], closing: null }; let got = 0;
    for (let i = 0; i < m.n; i++) {
      let scaffold = start, input = P.input;
      if (tap) scaffold = 3;
      else if (start === 1) scaffold = rand() < Math.min(0.95, P.p1 + 0.05 * Math.min(f, 2)) ? 1 : 2;
      else if (start === 0) { const r = rand(), p0 = Math.min(0.94, P.p0 + 0.08 * Math.min(f, 3)); scaffold = r < p0 ? 0 : r < p0 + ((1 - p0) * 2) / 3 ? 1 : 2; }
      const rec = { input, scaffold }, h = help(rec);
      got += xpFor({ kind: "reply", ...rec, flawed: false, attempt: 1, repeat: day.nodes[i].filter((x) => x <= h).length });
      day.nodes[i].push(h); run.replies.push(rec);
    }
    const c = tap ? { input: "tap", accepted: false, usedModelAnswer: true } : rand() < P.own ? { input: P.input, accepted: true, usedModelAnswer: false } : { input: P.input, accepted: true, usedModelAnswer: true };
    const ch = c.input === "tap" ? 2 : c.usedModelAnswer ? 1 : 0;
    got += xpFor({ kind: "closing", ...c, repeat: day.closing.filter((x) => x <= ch).length });
    day.closing.push(ch); run.closing = c;
    const deg = runDegree(run), src = { kind: "mission", missionKind: m.kind, level: m.level };
    if (!s.done) { got += xpFor({ ...src, firstTime: true, mastery: 0 }); coins += coinsFor({ ...src, firstTime: true, mastery: 0 }); s.done = true; }
    for (let d = s.mastery + 1; d <= deg; d++) { got += xpFor({ ...src, firstTime: false, mastery: d }); coins += coinsFor({ ...src, firstTime: false, mastery: d }); }
    s.mastery = Math.max(s.mastery, deg); s.runs++; s.last = sIdx;
    xp += got;
  };
  for (let s = 1; s <= sessions; s++) {
    if (!sameDay || s === 1) today = new Map();
    const before = levelAt(xp).level;
    if (scenario === "A") {
      for (let r = 0; r < P.runsA; r++) {
        // escolhe a missão que ainda paga cheio hoje: degrau novo a tentar, ou não jogada hoje
        const cand = [...missions].sort((a, b) => {
          const full = (m) => { const d = today.get(m.id); if (!d) return 0; const mode = m.kind === "boss" ? 3 : Math.min(S(m).mastery + 1, 3); const hNow = P.input === "tap" ? 3 : 3 - mode; return d.nodes[0].some((x) => x <= hNow) ? 1 + d.nodes[0].length : 0; };
          return full(a) - full(b) || S(a).mastery - S(b).mastery || S(a).last - S(b).last;
        })[0];
        runMission(cand, s);
      }
    } else {
      if (s > 1 && s % 2 === 0) missions.push({ id: `e${++newEnc}`, level: missions.length < 12 ? "A1" : missions.length < 30 ? "A2" : "B1", kind: "encounter", n: 6 });
      if (s > 1 && s % 6 === 0) missions.push({ id: `b${++newBoss}`, level: missions.length < 12 ? "A1" : missions.length < 30 ? "A2" : "B1", kind: "boss", n: 8 });
      const enc = missions.filter((m) => m.kind === "encounter"), boss = missions.filter((m) => m.kind === "boss");
      const done = new Set();
      const choose = (pool) => { const c = pool.filter((m) => !done.has(m.id)).sort((a, b) => S(a).runs === 0 !== (S(b).runs === 0) ? (S(a).runs === 0 ? -1 : 1) : (S(a).mastery < 3 ? 0 : 1) - (S(b).mastery < 3 ? 0 : 1) || S(a).last - S(b).last)[0]; if (c) { done.add(c.id); runMission(c, s); } return c; };
      let fresh = 0;
      for (let i = 0; i < P.encB; i++) {
        // 1 nova por dia no máximo; as outras são antigas com o menor domínio
        const pool = enc.filter((m) => !done.has(m.id) && (S(m).runs > 0 || fresh === 0));
        const c = [...pool].sort((a, b) => (fresh === 0 ? (S(a).runs === 0 ? -1 : 0) - (S(b).runs === 0 ? -1 : 0) : 0) || (S(a).mastery < 3 ? 0 : 1) - (S(b).mastery < 3 ? 0 : 1) || S(a).last - S(b).last)[0];
        if (!c) break; if (S(c).runs === 0) fresh++; done.add(c.id); runMission(c, s);
      }
      if (P.bossB) choose(boss);
      for (let i = 0; i < P.extraB; i++) choose(enc);
      const nSpells = Math.min(P.spellsB, Math.max(0, s - 1) * 2);
      for (let i = 0; i < nSpells; i++) {
        if (P.input === "tap") { xp += xpFor({ kind: "spell", input: "tap", grade: "good", gradedBy: "local", repeat: 0 }); continue; }
        const good = rand() < P.spellOk;
        xp += xpFor({ kind: "spell", input: P.input, grade: good ? "good" : "again", gradedBy: "local", repeat: 0 });
        if (!good) xp += xpFor({ kind: "spell", input: P.input, grade: "good", gradedBy: "local", repeat: 1 });
      }
      if (P.encB >= 3 && P.bossB) { xp += xpFor({ kind: "daily_complete" }); coins += coinsFor({ kind: "daily_complete" }); }
    }
    log.push({ s, xp, level: levelAt(xp).level, ups: levelAt(xp).level - before, coins, stars: [...st.values()].reduce((a, v) => a + v.mastery, 0), missions: missions.length });
  }
  return log;
}

function summarize(profile, opts, trials = 400) {
  const P = PROFILES[profile], runs = [];
  for (let t = 0; t < trials; t++) runs.push(play(profile, P, { ...opts, seed: 1000 + t * 7919 }));
  const med = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  const at = (s, k) => med(runs.map((r) => r[s - 1][k]));
  return { at, firstReach: (L) => med(runs.map((r) => (r.find((x) => x.level >= L)?.s ?? Infinity))) };
}

function table(scenario, marks, extra = {}) {
  const rows = [];
  for (const p of Object.keys(PROFILES)) {
    const S = summarize(p, { scenario, sessions: Math.max(...marks), ...extra });
    for (const m of marks) rows.push({ perfil: p, "sessão": m, XP: S.at(m, "xp"), "nível": S.at(m, "level"), "título": levelAt(S.at(m, "xp")).title, "XP/sessão (últimas 5)": m >= 6 ? Math.round((S.at(m, "xp") - S.at(m - 5, "xp")) / 5) : "-", "estrelas": S.at(m, "stars"), moedas: S.at(m, "coins") });
  }
  return rows;
}

console.log("== guardas =="); console.log(guards().join("\n"));
console.log("\n== curva =="); console.log([2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 23, 25, 31, 40, 50, 60].map((L) => `L${L}:${total(L)}`).join("  "));
console.log("\n== tabela de bônus de missão (first / *1 / *2 / *3) ==");
for (const kind of ["encounter", "boss"]) console.log(kind, CEFR.map((l) => `${l}: ${[xpFor({ kind: "mission", missionKind: kind, level: l, firstTime: true, mastery: 0 }), ...[1, 2, 3].map((d) => xpFor({ kind: "mission", missionKind: kind, level: l, firstTime: false, mastery: d }))].join("/")}`).join("  "));

console.log("\n== Cenário A: só o conteúdo da fase 2 (5 missões), 1 sessão por dia ==");
console.table(table("A", [1, 2, 3, 4, 5, 30, 90]));
console.log("subidas de nível na sessão 1:", Object.keys(PROFILES).map((p) => `${p}: ${summarize(p, { scenario: "A", sessions: 1 }).at(1, "ups")}`).join(" · "));
console.log("\n== Cenário A': as 5 sessões no mesmo dia ==");
console.table(table("A", [1, 2, 3, 4, 5], { sameDay: true }));
console.log("\n== Cenário B: fase 3 (missão do dia, grimório, conteúdo novo a cada 2 sessões) ==");
console.table(table("B", [1, 5, 10, 30, 60, 90]));
console.log("sessão (mediana) em que chega ao nível:");
for (const p of Object.keys(PROFILES)) { const S = summarize(p, { scenario: "B", sessions: 90 }); console.log(" ", p, [3, 5, 7, 8, 10, 12, 13, 16, 18, 19, 23, 25, 26, 31, 40, 50].map((L) => `L${L}: ${S.firstReach(L)}`).join("  ")); }
for (const p of Object.keys(PROFILES)) { const S = summarize(p, { scenario: "A", sessions: 90 }); console.log(" A", p, [2, 3, 5, 9, 10, 14, 16, 20, 23, 27].map((L) => `L${L}: ${S.firstReach(L)}`).join("  ")); }

// primeira missão, passo a passo
console.log("\n== 1ª missão (A1, 6 falas, frases à vista) ==");
for (const [name, input] of [["toca", "tap"], ["digita/fala", "voice"]]) {
  const r = 6 * xpFor({ kind: "reply", input, scaffold: input === "tap" ? 3 : 2, flawed: false, attempt: 1, repeat: 0 });
  const c = xpFor({ kind: "closing", input, accepted: input !== "tap", usedModelAnswer: input === "tap", repeat: 0 });
  const b = xpFor({ kind: "mission", missionKind: "encounter", level: "A1", firstTime: true, mastery: input === "tap" ? 0 : 1 });
  console.log(name, { falas: r, fecho: c, bonus: b, total: r + c + b, nivel: levelAt(r + c + b) });
}
```
