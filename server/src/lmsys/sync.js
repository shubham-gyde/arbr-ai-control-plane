// Fetches Elo ratings from the LMSYS Chatbot Arena leaderboard (via HuggingFace
// datasets server API) and writes a `general` capability score (0–1) for all models.
//
// Elo → 0-1: general = clamp((elo - 1000) / 500, 0, 1)
//   Elo 1000 → 0.0  (weak baseline)
//   Elo 1250 → 0.5  (mid-range)
//   Elo 1500 → 1.0  (top tier)
//
// Writes capabilities.general for any model that appears in the leaderboard,
// including models already covered by LiveBench (supplements the general dimension
// with human-preference Elo ratings).

const ModelEntry                 = require("../models/ModelEntry");
const Settings                   = require("../models/Settings");
const { normalize, prefixMatch } = require("../livebench/normalize");

const HF_BASE =
  "https://datasets-server.huggingface.co/rows" +
  "?dataset=lmarena-ai%2Fleaderboard-dataset&config=text&split=latest&length=100";

async function fetchLeaderboard() {
  const all = [];
  let offset = 0;
  let latestDate = null;

  for (;;) {
    const res = await fetch(`${HF_BASE}&offset=${offset}`, {
      headers: { "User-Agent": "arbr-control-plane" },
    });
    if (!res.ok) throw new Error(`LMSYS HuggingFace API returned ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`LMSYS HuggingFace API error: ${json.error}`);
    const rows = (json.rows || []).map((r) => r.row || r);
    if (rows.length === 0) break;

    // Dataset is sorted newest-first. Capture the latest date from the first page,
    // then stop as soon as rows from an older date appear.
    if (!latestDate) latestDate = rows[0].leaderboard_publish_date;
    const pageRows = rows.filter((r) => r.leaderboard_publish_date === latestDate);
    all.push(...pageRows);

    if (pageRows.length < rows.length) break; // crossed into older dates
    offset += rows.length;
  }

  return all;
}

async function run() {
  const rows = await fetchLeaderboard();

  // Build lookup: normalizedName → { elo, originalName }
  const lbIndex = {};
  for (const row of rows) {
    const name = row.model || row.model_name;
    const elo  = parseFloat(row.rating || row.elo_rating);
    if (!name || !isFinite(elo)) continue;
    const key = normalize(name);
    // If a model appears multiple times keep the highest Elo (most recent usually wins)
    if (!lbIndex[key] || elo > lbIndex[key].elo) {
      lbIndex[key] = { elo, originalName: name };
    }
  }

  // Process all models — LMSYS covers frontier models regardless of LiveBench status.
  // Elo-based general score supplements LiveBench's task-performance general score.
  const models = await ModelEntry.find({}).lean();
  const now    = new Date();
  let matched  = 0;
  const skipped = [];

  for (const model of models) {
    const ourKey = normalize(model.id);

    let entry = lbIndex[ourKey];
    if (!entry) {
      for (const [lbKey, lbEntry] of Object.entries(lbIndex)) {
        if (prefixMatch(ourKey, lbKey)) { entry = lbEntry; break; }
      }
    }

    if (!entry) { skipped.push(model.id); continue; }

    const general = Math.min(1, Math.max(0, (entry.elo - 1000) / 500));

    await ModelEntry.updateOne(
      { id: model.id },
      {
        $set: {
          "capabilities.general": general,
          lmsysSyncedAt:          now,
          lmsysModelName:         entry.originalName,
        },
      }
    );
    matched++;
  }

  // Persist sync metadata
  const version = new Date().toISOString().slice(0, 10);
  await Settings.findOneAndUpdate(
    { key: "global" },
    { $set: { lmsysSyncedAt: now, lmsysVersion: version } },
    { upsert: true }
  );

  console.log(`[lmsys] synced ${matched}/${models.length} models`);
  return { matched, total: models.length, version, skipped };
}

module.exports = { run };
