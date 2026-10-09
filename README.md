# AEGIS Dynamics · Project Sentinel

A cinematic fictional research company built around a real Unity reinforcement-learning project: [Days Gone Quiet](https://github.com/dane-anderson/days_gone_quiet).

AEGIS is the working fictional identity. It is unaffiliated with other organizations using the AEGIS name. The site does not represent an operational defense company.

## What's available

- Public cinematic site: headquarters, mission, Sentinel Command, Days Gone Quiet, and Athena's executive profile.
- Sentinel Command: three selected local training runs, 938 original TensorBoard reward samples, separate run and policy selectors, chart/table views, a source manifest, and a downloadable snapshot.
- Hypotheses, research roadmap, and a curated Athena briefing.
- A browser-local research notebook. Notes are stored on the current browser only and can be downloaded.

Athena is a fictional artificial executive. There is no live AI model, voice connection, authenticated private workspace, experiment database, or automated ingestion yet. The dashboard is a public curated snapshot. It is not suitable for private research records until server-side authentication is added.

## Run locally

From this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory public
```

Open http://127.0.0.1:4173. Use an HTTP server: opening the HTML file directly will not load the research JSON.

No application dependencies or build are required. Fonts are served by Google Fonts, with local system-font fallbacks.

## Deploy to Render

Create a **Static Site**, use this repository's `main` branch, set build command to `echo 'Static assets ready'`, and publish directory to `public`. `render.yaml` contains the equivalent reproducible configuration. Static hosting has no separate instance charge; workspace bandwidth and build usage still follow the account's limits.

## Data provenance

`public/data/research.json` contains the selected snapshot. It was exported read-only from local ML-Agents output on October 9, 2026. The original Unity repository and training output were not edited by this web project.

The three selected runs are `prison-duo-v2`, `barn-team-v2`, and `prison-duo-v1`. Exported sources include training status, run configuration, and TensorBoard scalar files. SHA-256 hashes record each source file. Machine-specific event filenames are redacted from the public manifest. Model weights, absolute filesystem paths, and research notebook contents are not published.

The public Unity source revision is context; local work includes changes that have not been committed. Exact environment revisions and evaluation seeds were not recorded for these runs. Environment names are descriptive run labels. A saved checkpoint below its step target does not establish why training ended, and no current process state is inferred.

The chart shows every retained `Environment/Cumulative Reward` scalar without smoothing. Checkpoint summary reward is a different record and may not equal the last TensorBoard scalar. Rick and Negan use different reward functions. Reward is not a success percentage or proof of cooperation, reliable task performance, or transfer.

To refresh using a Python environment with TensorBoard and PyYAML installed:

```sh
python scripts/export_research.py --results /path/to/results --output public/data/research.json
```

Review the selected runs and snapshot before publishing. The exporter only reads existing records; it does not start, stop, resume, or modify training. Refreshing is a manual action, not an installed automation.

## Art and identity

The AEGIS headquarters, Sentinel Command theater, and Athena portrait are original AI-generated concept assets. The image prompts and generation method are in `IMAGE-PROMPTS.txt`. The Days Gone Quiet image is existing environment concept art from the user's Unity project, not a screenshot of a running scene.

## Architecture and next steps

The site uses buildless HTML, CSS, and JavaScript. Hash routes allow static-host refresh and deep linking. No credentials are present in browser code. Next work is controlled evaluation, a server-side authenticated research workspace, and a source-grounded Athena service. Preserve the distinction between fictional world-building and verified results.
