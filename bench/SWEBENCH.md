# SWE-bench Verified (Phase 3)

SWE-bench is **agentic and Docker-heavy**: solving an instance means an agent explores a repo, edits
files, and runs tests; scoring means applying the patch and running the repo's test suite in a
container. We deliberately **reuse the official pieces** and only add the Arbr integration:

- **Patch generation:** an existing agent (e.g. [mini-SWE-agent] or SWE-agent) pointed at **Arbr's
  OpenAI-compatible gateway** as its model endpoint. Each agent step is an Arbr request, so Arbr does
  the routing and logs cost/served-model/decision. Run once per baseline (pin the model, or `auto` for
  `arbr-auto`).
- **Scoring:** the **official `swebench.harness.run_evaluation`** (Docker) applies patches and runs
  tests, producing a report JSON. We do NOT reimplement this — the official harness is the credible
  scorer.
- **Arbr integration (this repo):** `bench/scorers/swebench.js` + `bench/swebench/from-report.js` turn
  the official report + the baseline's total cost into standard bench rows, so `bench/aggregate.js`
  yields the same **cost-vs-resolved** curve as the other benchmarks.

## Pipeline (per baseline)
```sh
# 1. Generate predictions with an agent pointed at Arbr. Tag each baseline's traffic to its own
#    application (e.g. bench-swe-arbr-auto) so cost is attributable in Arbr analytics.
#    Configure the agent: base_url=$ARBR_BASE_URL, api_key=$ARBR_API_KEY, model=<pool model | "auto">.
#    → produces predictions.jsonl (instance_id + model_patch).

# 2. Official evaluation (Docker) → report json:
python -m swebench.harness.run_evaluation \
  --dataset_name princeton-nlp/SWE-bench_Verified \
  --predictions_path predictions.arbr-auto.jsonl --run_id arbr-auto

# 3. Read Arbr analytics for that baseline's total cost (its tagged application), then convert:
node bench/swebench/from-report.js --report <run_id>.report.json --baseline arbr-auto --cost <USD> --tag v1

# repeat 1–3 for always-premium / always-light / random / routellm, then:
node bench/aggregate.js bench/results/swebench-v1.jsonl
```

## Quick pipeline check (no Docker/agent)
```sh
node bench/swebench/from-report.js --report bench/fixtures/swebench.report.sample.json --baseline arbr-auto --cost 10 --tag demo
node bench/aggregate.js bench/results/swebench-demo.jsonl   # → 60% resolved, $2/instance
```
`npm run smoke:bench` covers `resolvedRate` + `rowsFromReport` with no I/O.

## Notes
- Total cost per baseline comes from Arbr's per-application analytics (agent runs are many calls) ÷
  instances; disclose it alongside resolved-rate.
- SWE-bench is the flagship for Arbr's **task-aware + tool-capable** routing, but it's the most
  expensive to run (compute + API) — budget accordingly.

[mini-SWE-agent]: https://github.com/SWE-agent/mini-swe-agent
