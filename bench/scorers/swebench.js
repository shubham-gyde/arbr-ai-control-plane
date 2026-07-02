// SWE-bench Verified integration.
//
// We do NOT reimplement patch application / test execution — the OFFICIAL SWE-bench harness
// (Docker-per-repo) is the credible scorer and reimplementing it would be less trustworthy. Instead we
// read the official evaluation *report* and convert it into the harness's standard benchmark rows, so
// bench/aggregate.js produces the cost-vs-resolved curve like the other benchmarks. Patch generation is
// done by an existing agent pointed at Arbr's gateway (see bench/SWEBENCH.md).
function parseReport(report) {
  const resolvedIds = report.resolved_ids || report.resolvedIds || [];
  const unresolvedIds = report.unresolved_ids || report.unresolvedIds || [];
  const attemptedIds =
    report.submitted_ids || report.completed_ids ||
    (resolvedIds.length || unresolvedIds.length ? [...resolvedIds, ...unresolvedIds] : []);
  return { resolvedIds, attemptedIds };
}

// { resolved, attempted, rate } for a single baseline's official report.
function resolvedRate(report) {
  const { resolvedIds, attemptedIds } = parseReport(report);
  const attempted = attemptedIds.length;
  return { resolved: resolvedIds.length, attempted, rate: attempted ? resolvedIds.length / attempted : null };
}

// One standard bench row per attempted instance (score 1 if resolved). cost = totalCost / instances
// (agentic runs are metered per-baseline via Arbr, not per-instance). Feeds bench/aggregate.js unchanged.
function rowsFromReport(report, { baseline, totalCost = 0 }) {
  const { resolvedIds, attemptedIds } = parseReport(report);
  const resolved = new Set(resolvedIds);
  const n = attemptedIds.length || 1;
  const per = totalCost / n;
  return attemptedIds.map((id) => ({
    benchmark: "swebench", questionId: id, category: "coding", baseline,
    scored: true, score: resolved.has(id) ? 1 : 0,
    costUsd: per, priced: totalCost > 0,
  }));
}

module.exports = { parseReport, resolvedRate, rowsFromReport };
