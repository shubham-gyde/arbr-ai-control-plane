// Convert an OFFICIAL SWE-bench evaluation report into standard benchmark rows (one per instance),
// appending per baseline. Then aggregate with bench/aggregate.js like any other benchmark.
//   node bench/swebench/from-report.js --report <official-report.json> --baseline arbr-auto --cost 12.34 [--tag run]
// Run once per baseline; --cost is that baseline run's total USD (from Arbr analytics for its tagged app).
const fs = require("fs");
const path = require("path");
const { rowsFromReport } = require("../scorers/swebench");

function arg(n, d) { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : d; }

const reportPath = arg("report");
const baseline = arg("baseline");
const cost = Number(arg("cost", "0")) || 0;
const tag = arg("tag", "run");
if (!reportPath || !baseline) {
  console.error("usage: --report <official-report.json> --baseline <name> [--cost USD] [--tag t]");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const rows = rowsFromReport(report, { baseline, totalCost: cost });
const out = path.join(__dirname, "..", "results", `swebench-${tag}.jsonl`);
fs.appendFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`Appended ${rows.length} rows (baseline=${baseline}, cost=$${cost}) → ${out}`);
console.log(`When all baselines are in: node bench/aggregate.js ${out}`);
