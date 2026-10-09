"""Read-only export of selected ML-Agents runs. Never changes training files."""
import argparse, hashlib, json, math
from datetime import datetime, timezone
from pathlib import Path
import yaml
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

parser = argparse.ArgumentParser()
parser.add_argument('--results', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
RUNS = ['prison-duo-v2', 'barn-team-v2', 'prison-duo-v1']
TAG = 'Environment/Cumulative Reward'

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def date(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()

snapshot = {'schemaVersion': 1, 'exportedAt': datetime.now(timezone.utc).isoformat(), 'sourceRepository': 'https://github.com/dane-anderson/days_gone_quiet', 'sourceCommit': '953c63518c142ab8f540dc433503c185bb973736', 'scope': 'Selected local training records; not a live feed or a controlled evaluation.', 'metric': TAG, 'runs': []}
for run_id in RUNS:
    folder = args.results / run_id
    status_file = folder / 'run_logs/training_status.json'
    config_file = folder / 'configuration.yaml'
    status = json.loads(status_file.read_text())
    config = yaml.safe_load(config_file.read_text())
    record = {'id': run_id, 'environment': 'Barn encounter' if run_id.startswith('barn') else 'Prison yard', 'environmentEvidence': 'Descriptive run label; exact scene revision was not logged.', 'sources': [{'path': f'{run_id}/run_logs/training_status.json', 'sha256': digest(status_file)}, {'path': f'{run_id}/configuration.yaml', 'sha256': digest(config_file)}], 'policies': []}
    for behavior in ['RickEscape', 'NeganCombat']:
        ea = EventAccumulator(str(folder / behavior), size_guidance={'scalars': 0})
        ea.Reload()
        events = ea.Scalars(TAG)
        # TensorBoard's loader handles resumed-session purging. Preserve every retained point.
        points = [{'step': x.step, 'value': x.value, 'recordedAt': date(x.wall_time)} for x in events if math.isfinite(x.value)]
        final = status[behavior]['final_checkpoint']
        settings = config['behaviors'][behavior]
        policy = {'name': behavior, 'algorithm': settings['trainer_type'].upper(), 'targetSteps': settings['max_steps'], 'checkpointSteps': final['steps'], 'checkpointReward': final.get('reward'), 'checkpointAt': date(final['creation_time']), 'modelExportPresent': (folder / f'{behavior}.onnx').is_file(), 'points': points, 'network': {'hiddenUnits': settings['network_settings']['hidden_units'], 'layers': settings['network_settings']['num_layers']}}
        record['policies'].append(policy)
        for i, event_file in enumerate(sorted((folder / behavior).glob('events.out.tfevents.*')), 1):
            record['sources'].append({'path': f'{run_id}/{behavior}/TensorBoard event file {i} (filename redacted)', 'sha256': digest(event_file)})
    snapshot['runs'].append(record)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(snapshot, indent=2, allow_nan=False)+'\n')
print(json.dumps({'runs': len(snapshot['runs']), 'points': sum(len(p['points']) for r in snapshot['runs'] for p in r['policies']), 'output': str(args.output)}))
