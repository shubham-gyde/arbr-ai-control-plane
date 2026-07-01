// Pure-logic smoke for the benchmark harness (no network / no keys). Run: npm run smoke:bench
const { costUsd } = require("../../bench/lib/cost");
const { summarize } = require("../../bench/lib/summarize");
const { seededRand } = require("../../bench/lib/router");
const livebench = require("../../bench/scorers/livebench");
const arena = require("../../bench/scorers/arenahard");
const swe = require("../../bench/scorers/swebench");

let pass = 0, fail = 0;
const eq = (got, exp, msg) => {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) { pass++; } else { fail++; console.log(`FAIL: ${msg} — got ${g}, expected ${e}`); }
};
const approx = (got, exp, msg) => eq(Number(got.toFixed(4)), Number(exp.toFixed(4)), msg);

const PRICES = { "gpt-4o": { in: 2.5, out: 10 }, "gpt-4o-mini": { in: 0.15, out: 0.6 } };

// 1. cost = tokens × price; unknown model flagged.
approx(costUsd("gpt-4o", { prompt_tokens: 1e6, completion_tokens: 1e6 }, PRICES).usd, 12.5, "gpt-4o cost");
eq(costUsd("mystery", { prompt_tokens: 1000 }, PRICES).priced, false, "unknown model → unpriced flag");

// 2. LiveBench objective scoring; non-objective categories not silently scored.
eq(livebench.score({ category: "math", ground_truth: "42" }, "reasoning...\n\\boxed{42}").score, 1, "boxed match → 1");
eq(livebench.score({ category: "math", ground_truth: "42" }, "the answer is 41").score, 0, "wrong → 0");
eq(livebench.score({ category: "coding", ground_truth: "x" }, "def f(): ...").scored, false, "coding → needs official grader");

// 3. seeded RNG is deterministic (reproducible "random" baseline).
eq(seededRand(42, 3)(), seededRand(42, 3)(), "seededRand reproducible");

// 4. summarize: quality over scored rows, cost/query, and vs-premium derivations.
const rows = [
  { baseline: "always-premium", category: "math", scored: true, score: 1, costUsd: 0.10, priced: true },
  { baseline: "always-premium", category: "math", scored: true, score: 1, costUsd: 0.10, priced: true },
  { baseline: "arbr-auto",      category: "math", scored: true, score: 1, costUsd: 0.02, priced: true },
  { baseline: "arbr-auto",      category: "math", scored: true, score: 0, costUsd: 0.02, priced: true },
  { baseline: "arbr-auto",      category: "coding", scored: false, score: null, costUsd: 0.02, priced: true }, // excluded from quality
  { baseline: "arbr-auto",      category: "math", error: "boom" },
];
const s = summarize(rows);
eq(s["always-premium"].quality, 1, "premium quality = 1.0");
eq(s["arbr-auto"].quality, 0.5, "arbr quality = 1/2 scored (coding excluded)");
eq(s["arbr-auto"].errors, 1, "arbr error counted");
approx(s["arbr-auto"].qualityRetainedPct, 50, "arbr retained 50% of premium quality");
approx(s["arbr-auto"].costPerQuery, 0.015, "arbr cost/query over 4 rows incl error");
approx(s["always-premium"].costPerQuery, 0.10, "premium cost/query");

// 5. Arena-Hard win mapping (candidate=B vs reference=A): better→win, tie→0.5, worse→0.
eq(arena.winFromVerdict("better"), 1, "candidate better → win 1");
eq(arena.winFromVerdict("equal"), 0.5, "tie → 0.5");
eq(arena.winFromVerdict("worse"), 0, "candidate worse → 0");

// 6. SWE-bench: read official report → resolved-rate + standard rows for aggregate.
const sweReport = { total_instances: 5, resolved_ids: ["a", "b", "c"], unresolved_ids: ["d", "e"] };
eq(swe.resolvedRate(sweReport).resolved, 3, "swe resolved count");
approx(swe.resolvedRate(sweReport).rate, 0.6, "swe resolved rate 3/5");
const sweRows = swe.rowsFromReport(sweReport, { baseline: "arbr-auto", totalCost: 10 });
eq(sweRows.length, 5, "swe rows = attempted instances");
eq(sweRows.filter((r) => r.score === 1).length, 3, "swe resolved rows scored 1");
approx(sweRows[0].costUsd, 2, "swe cost/instance = total/5");
// And they aggregate through the SAME summarize() → 60% quality:
approx(summarize(sweRows)["arbr-auto"].quality, 0.6, "swe rows aggregate to 0.6 resolved-rate");

console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
