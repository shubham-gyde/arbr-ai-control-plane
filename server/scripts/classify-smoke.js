// Pure-logic smoke test for the classifier (no DB / no provider keys needed).
// Run: npm run smoke:classify
const c = require("../src/classify/classifier");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("FAIL:", msg); } };

// Latest user turn drives classification (not the first turn of a conversation).
const convo = [
  { role: "user", content: "translate hello to french" },
  { role: "assistant", content: "bonjour" },
  { role: "user", content: "now write me a python web scraper for this site" },
];
ok(c.lastUserText(convo).includes("python web scraper"), "lastUserText = latest user turn");
ok(c.firstUserText(convo).includes("translate"), "firstUserText = first turn (unchanged)");
ok(c.classify({ messages: convo }).taskType === "coding", "classify uses latest turn -> coding");

// Difficulty: easy vs hard instances of the SAME task family route to different tiers.
ok(c.tierForTask("coding") === "mid", "coding default tier = mid");
ok(c.estimateDifficulty("rename this var", "coding") === "light", "trivial coding -> light");
ok(c.estimateDifficulty(
  "design and implement an end-to-end distributed scheduler, step by step, across multiple services",
  "coding") === "premium", "complex multi-step coding -> premium");

// Difficulty label normalization.
ok(c.normalizeDifficulty("HARD") === "premium", "normalize HARD -> premium");
ok(c.normalizeDifficulty("easy") === "light", "normalize easy -> light");
ok(c.normalizeDifficulty("medium") === "mid", "normalize medium -> mid");
ok(c.normalizeDifficulty("banana") === null, "normalize junk -> null");

// No keyword match -> safe default.
ok(c.classify({ messages: [{ role: "user", content: "zxcv qwer" }] }).taskType === "content generation",
  "no match -> content generation default");

console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
