# AEGIS Dynamics · Project Sentinel

[Sentinel Command](https://aegis-sentinel-6u5m.onrender.com/#command) connects the fictional AEGIS research world to real Unity ML-Agents experiments.

Rick navigates, Negan protects, and Scout reports safe routes. Their three Sentinel policies share mission rewards. The dashboard shows exact episode outcomes separately for training, scripted demonstrations, and saved-policy evaluation. Training reward is never treated as a success rate.

## Connected evidence

Unity's `SentinelTelemetry` writes append-only local JSONL records. Each episode includes its identity, mode, run identity when launched through the connected launcher, route milestones and times, survival, per-agent health/movement/reward/kills, environment fingerprint and settings, and saved model hashes where available. Interrupted episodes do not enter completion denominators. Mechanics validation and mixed-policy sessions are excluded from the primary categories.

`export_research.py` discovers configured `rick_*`, `prison-duo-*`, `barn-team-*` and `sentinel-*` runs, including future runs in these families. It discovers the role policies from configuration, handles missing checkpoints and absent scalar tags, defers incomplete final JSONL lines, deduplicates episode identities, and fails on conflicting or corrupt completed evidence. A missing results folder does not replace good public data with an empty snapshot. Source paths are relative, machine-specific event filenames are removed, and model weights and private notebook contents are not published.

Groups separate run, mode, source fingerprint, model hashes and experiment settings. Every outcome denominator counts an episode once, rather than once per policy. The downloaded snapshot contains the full episode evidence. Historical runs lack exact scene fingerprints and are labeled accordingly. No matched baseline has established a causal benefit from cooperation; requiring all three roles by design is not proof of that benefit.

## Supply Run

Supply Run connects the prison depot to the barn through two routes and a sheltered waystation. Rick retrieves three supply units, Scout reports the safer route, and Negan protects the team. Delivery requires the outward route, regrouping, cargo pickup, the return checkpoint, and all three survivors home.

`SupplyRunTelemetry` emits version 2 episode records into the same local telemetry folder. The importer accepts only `SupplyRick`, `SupplyNegan`, and `SupplyScout` for this mission. Its groups and facts stay separate from the original cooperation mission. The dashboard's mission selector shows route reports, cargo collection, team return, successful trips, delivered units, injuries and duration. Validation, scripted demonstrations, training and saved-model evaluation remain distinct. Athena always receives the Supply Run training outcome alongside the original mission's outcome and interpretation limits.

Use a fresh `sentinel-supply-*` run ID with `--config Assets/Expeditions/Config/supply_run.yaml` and open `SupplyRun` before pressing Play. These policies use 80 observations and must be trained from scratch; older mission models have incompatible inputs. The recorded smoke run checks connectivity and export, not learned mission mastery.

## Athena

`scripts/athena_brief.py` calls the existing local Ollama service on loopback with `qwen3.5:9b`. Athena receives verified facts, grouped episode outcomes, the latest 12 relevant episodes, and checkpoint details and recent reward samples from every imported Days Gone Quiet run. Her findings must include the earlier training history when available. Different tasks retain separate reward scales; reaching a step budget is not proof of mastery. Her response selects important evidence references and a next experiment. Public finding wording and numbers come directly from the validated fact catalog, preventing model-written invented measurements. Each briefing records its model, generation time and exact snapshot fingerprint. No new paid API is required.

If the local model is unavailable, measurements can still publish while the site clearly reports that Athena's AI briefing is unavailable. It retries on a later sync. This is a batch AI research briefing. The executive video remains a prerecorded fictional transmission; live conversation, persistent memory and interactive voice are future work. Browser notebook entries stay local.

## Local connection

Use Python with TensorBoard and PyYAML (the existing ML-Agents environment includes both). Keep private connection configuration outside this repository:

```json
{
  "results": ["/path/to/results"],
  "telemetry": ["/path/to/results/sentinel-telemetry"],
  "model": "qwen3.5:9b"
}
```

Prepare a snapshot and AI brief:

```sh
python scripts/sync_research.py --config /path/to/private-sync-config.json
```

For unattended publication, start with a clean, current `main` checkout:

```sh
python scripts/sync_research.py --config /path/to/private-sync-config.json --publish
```

The publisher locks the checkout, validates both files, commits only `public/data/research.json` and `public/data/athena.json`, and pushes to the existing remote. It refuses unrelated dirty edits, other branches, remote divergence, and unpublished implementation commits. A network-failed push can retry its own data-only commit. Unchanged evidence with a current briefing produces no commit or model call. Do not put private configuration or credentials in `public/`.

The user's connected Unity launcher publishes when training finishes. A Codex heartbeat periodically catches new local episode results; it requires that computer and Codex to be available. The site polls for published snapshots every minute and displays the evidence timestamp. This is not a live Unity stream. Render deploys after a successful push, so publication is not instantaneous.

In Unity, `Assets/Sentinel/Tools/train_connected.py --run-id=sentinel-phase1-v1` uses the current Python environment's `mlagents-learn`, creates a temporary manifest binding telemetry to the run, and calls the sync on completion. Local `UserSettings/SentinelConnection.json` configures `trainerPort`, `syncScript`, and `syncConfig`. Stop competing trainers, use a fresh run ID or `--resume`, and press Play in SentinelCooperation. `--no-publish` is available for connection tests. Existing prison and barn policies have incompatible observation shapes and must not be assigned to the Sentinel agents.

## Preview and checks

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory public
python -m unittest discover -s scripts -p test_connection.py
python scripts/check_site.py
node --check public/app.js
```

The site is static HTML/CSS/JavaScript hosted on Render from `main`, using publish directory `public`. `render.yaml` records the configuration. No browser credentials or local model service are exposed to visitors.

## Files

- `public/index.html`, `app.js`, `styles.css`: public site and cooperation dashboard.
- `public/data/research.json`: training records, episode evidence, hashes and fact catalog.
- `public/data/athena.json`: current model-selected briefing and source reference.
- `scripts/export_research.py`: read-only, allowlisted data export.
- `scripts/athena_brief.py`: bounded local AI briefing.
- `scripts/sync_research.py`: validated preparation and optional publication.
- `scripts/test_connection.py`, `check_site.py`: evidence and package checks.

Facility and character artwork are AI-generated concepts; Unity concept art is not a simulation capture. AEGIS is a fictional working identity for an independent research project, unaffiliated with other AEGIS organizations. See [image prompts and generation method](IMAGE-PROMPTS.txt).
