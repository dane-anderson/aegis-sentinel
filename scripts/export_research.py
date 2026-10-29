"""Read-only, allowlisted export of ML-Agents records and Sentinel episode evidence."""
import argparse
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
import yaml
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

RUN_FAMILIES = (
    (r'sentinel-supply-[A-Za-z0-9_-]{1,60}', {'SupplyRick', 'SupplyNegan', 'SupplyScout'}, 'Prison–barn supply expedition'),
    (r'sentinel-[A-Za-z0-9_-]{1,70}', {'SentinelRick', 'SentinelNegan', 'SentinelScout'}, 'Sentinel cooperation'),
    (r'prison-duo-[A-Za-z0-9_-]{1,60}', {'RickEscape', 'NeganCombat'}, 'Prison yard'),
    (r'barn-team-[A-Za-z0-9_-]{1,60}', {'RickEscape', 'NeganCombat'}, 'Barn encounter'),
    (r'rick_[A-Za-z0-9_-]{1,70}', {'My Behavior'}, 'Early Rick survival experiments'),
)
MODES = {'training', 'evaluation', 'scripted_demo', 'validation', 'untrained_or_mixed'}
TAG = 'Environment/Cumulative Reward'
EPISODE_KEYS = ('sessionId episodeId runId timestamp mode outcome environmentFingerprint scene condition round seed blockedRoute safeRoute randomized routeReported routeReached guardianCleared allSurvived durationSeconds reportAt routeAt guardianAt maxSeconds walkerSpeed walkerHealth walkerCount').split()
AGENT_KEYS = ('role policy modelHash health maximumHealth reward distance kills alive').split()
SUPPLY_KEYS = ('missionType stage cargoUnits suppliesDelivered cargoCollected regrouped returnRouteReached returnedTogether regroupAt collectedAt returnAt deliveredAt damageTaken').split()

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()

def now():
    return datetime.now(timezone.utc).isoformat()

def date(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat() if timestamp else None

def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)

def run_family(name):
    return next(((policies, label) for pattern, policies, label in RUN_FAMILIES if re.fullmatch(pattern, name)), None)

def scalars(folder, tag):
    if not folder.exists():
        return []
    ea = EventAccumulator(str(folder), size_guidance={'scalars': 0})
    ea.Reload()
    if tag not in ea.Tags().get('scalars', []):
        return []
    return [{'step': x.step, 'value': x.value, 'recordedAt': date(x.wall_time)} for x in ea.Scalars(tag) if math.isfinite(x.value)]

def export_runs(roots):
    runs = []
    seen = set()
    for root in roots:
        if not root.is_dir():
            raise ValueError('A configured results folder is unavailable; preserving published data.')
        for folder in sorted(root.iterdir()):
            family = run_family(folder.name)
            if not folder.is_dir() or family is None:
                continue
            if folder.name in seen:
                raise ValueError('Duplicate run ID across source folders: ' + folder.name)
            config_file = folder / 'configuration.yaml'
            if not config_file.exists():
                continue  # Trainer has not initialized this run yet.
            config = yaml.safe_load(config_file.read_text())
            behaviors = config.get('behaviors', {})
            allowed_policies, environment = family
            if not set(behaviors).issubset(allowed_policies) or not behaviors:
                raise ValueError('Unexpected policy in ' + folder.name)
            seen.add(folder.name)
            status_file = folder / 'run_logs/training_status.json'
            status = json.loads(status_file.read_text()) if status_file.exists() else {}
            sources = [{'path': f'{folder.name}/configuration.yaml', 'sha256': digest(config_file)}]
            if status_file.exists():
                sources.append({'path': f'{folder.name}/run_logs/training_status.json', 'sha256': digest(status_file)})
            policies = []
            for behavior, settings in behaviors.items():
                points = scalars(folder / behavior, TAG)
                final = status.get(behavior, {}).get('final_checkpoint') or {}
                model = folder / f'{behavior}.onnx'
                policies.append({'name': behavior, 'algorithm': settings['trainer_type'].upper(), 'targetSteps': settings['max_steps'], 'checkpointSteps': final.get('steps'), 'checkpointReward': final.get('reward'), 'checkpointAt': date(final.get('creation_time')), 'modelExportPresent': model.is_file(), 'modelHash': digest(model) if model.exists() else None, 'points': points, 'network': {'hiddenUnits': settings['network_settings']['hidden_units'], 'layers': settings['network_settings']['num_layers']}})
                for i, event_file in enumerate(sorted((folder / behavior).glob('events.out.tfevents.*')), 1):
                    sources.append({'path': f'{folder.name}/{behavior}/TensorBoard event file {i}', 'sha256': digest(event_file)})
            runs.append({'id': folder.name, 'kind': 'smoke_test' if 'smoke' in folder.name else 'training', 'environment': environment, 'environmentEvidence': 'Environment labels describe the run family, not a verified scene. Exact environment fingerprints are attached to new episode records; older reward logs alone do not identify the scene revision.', 'policies': policies, 'sources': sources})
    return sorted(runs, key=lambda r: (not r['id'].startswith('sentinel-'), r['id']))

def clean_episode(record):
    supply = record.get('schemaVersion') == 2 and record.get('missionType') == 'supply_run'
    if (record.get('schemaVersion') != 1 and not supply) or record.get('mode') not in MODES:
        raise ValueError('Unsupported episode schema or mode')
    if not re.fullmatch(r'[a-f0-9]{32}-\d+', str(record.get('episodeId', ''))):
        raise ValueError('Invalid episode identity')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', str(record.get('runId', ''))):
        raise ValueError('Invalid run identity')
    if record.get('outcome') not in {'success', 'death', 'timeout', 'interrupted'}:
        raise ValueError('Invalid outcome')
    for key in ('durationSeconds', 'reportAt', 'routeAt', 'guardianAt', 'maxSeconds', 'walkerSpeed', 'walkerHealth'):
        if not finite(record.get(key)):
            raise ValueError('Non-finite episode data')
    for key in ('routeReported', 'routeReached', 'guardianCleared', 'allSurvived', 'randomized'):
        if not isinstance(record.get(key), bool):
            raise ValueError('Invalid episode flag')
    agents = record.get('agents', [])
    expected_policies = {'SupplyRick', 'SupplyNegan', 'SupplyScout'} if supply else {'SentinelRick', 'SentinelNegan', 'SentinelScout'}
    if {a.get('policy') for a in agents} != expected_policies or len(agents) != 3:
        raise ValueError('Episode must contain all three policies')
    required = ('routeReported', 'routeReached', 'allSurvived') if supply else ('routeReported', 'routeReached', 'guardianCleared', 'allSurvived')
    if record['outcome'] == 'success' and not all(record[k] for k in required):
        raise ValueError('Success without required milestones')
    if supply:
        for key in ('cargoCollected','regrouped','returnRouteReached','returnedTogether'):
            if not isinstance(record.get(key),bool): raise ValueError('Invalid supply milestone')
        for key in ('regroupAt','collectedAt','returnAt','deliveredAt','damageTaken'):
            if not finite(record.get(key)): raise ValueError('Invalid supply measurement')
        if any(type(record.get(k)) is not int for k in ('cargoUnits','suppliesDelivered')):
            raise ValueError('Supply counts must be integers')
        if not 0 <= record['suppliesDelivered'] <= record['cargoUnits'] or record['cargoUnits'] <= 0 or record['damageTaken'] < 0:
            raise ValueError('Invalid supply count or injuries')
        if record['outcome'] == 'success' and (not all(record[k] for k in ('cargoCollected','regrouped','returnRouteReached','returnedTogether')) or record['suppliesDelivered'] != record['cargoUnits']):
            raise ValueError('Supply success requires cargo and the whole team home')
        if record['outcome'] != 'success' and record['suppliesDelivered'] != 0:
            raise ValueError('Failed supply episode cannot claim delivery')
    for agent in agents:
        if not all(finite(agent.get(k)) for k in ('health', 'maximumHealth', 'reward', 'distance', 'kills')):
            raise ValueError('Invalid agent measurement')
    result = {k: record[k] for k in EPISODE_KEYS}
    if supply: result.update({k:record[k] for k in SUPPLY_KEYS})
    result['agents'] = [{k: a[k] for k in AGENT_KEYS} for a in agents]
    # A strict public boundary also catches accidental private strings in allowed fields.
    serialized = json.dumps(result, allow_nan=False)
    if '/Users/' in serialized or 'api_key' in serialized.lower():
        raise ValueError('Private field in episode')
    return result

def export_episodes(roots):
    episodes, sources = {}, []
    skipped_partial = 0
    for root in roots:
        if not root.is_dir():
            raise ValueError('A configured telemetry folder is unavailable; preserving published data.')
        for file in sorted(root.glob('*.jsonl')):
            raw = file.read_bytes()
            lines = raw.splitlines(keepends=True)
            # A writer may be appending its last record while we read. Retry next sync.
            if lines and not lines[-1].endswith(b'\n'):
                skipped_partial += 1
                lines.pop()
            for line in lines:
                record = json.loads(line)
                if record.get('eventType') != 'finish':
                    continue
                episode = clean_episode(record)
                key = episode['episodeId']
                if key in episodes and episodes[key] != episode:
                    raise ValueError('Conflicting duplicate episode')
                episodes[key] = episode
            sources.append({'path': 'sentinel-telemetry/' + file.name, 'sha256': hashlib.sha256(b''.join(lines)).hexdigest()})
    return sorted(episodes.values(), key=lambda e: (e['timestamp'], e['episodeId'])), sources, skipped_partial

def group_episodes(episodes):
    grouped = defaultdict(list)
    for e in episodes:
        identity = {k: e[k] for k in ('mode', 'runId', 'environmentFingerprint', 'condition', 'seed', 'randomized', 'maxSeconds', 'walkerSpeed', 'walkerHealth', 'walkerCount')}
        identity['models'] = {a['policy']: a['modelHash'] for a in e['agents']}
        if e.get('missionType') == 'supply_run':
            identity.update(missionType='supply_run', cargoUnits=e['cargoUnits'])
        grouped[fingerprint(identity)[:16]].append(e)
    groups = []
    for key, all_records in grouped.items():
        rows = [e for e in all_records if e['outcome'] != 'interrupted']
        n = len(rows)
        count = lambda field: sum(e[field] for e in rows)
        groups.append({'id': key, 'mode': all_records[0]['mode'], 'runId': all_records[0]['runId'], 'environmentFingerprint': all_records[0]['environmentFingerprint'], 'completed': n, 'interrupted': len(all_records)-n, 'successes': sum(e['outcome'] == 'success' for e in rows), 'routeReported': count('routeReported'), 'routeReached': count('routeReached'), 'guardianCleared': count('guardianCleared'), 'allSurvived': count('allSurvived'), 'meanSeconds': sum(e['durationSeconds'] for e in rows)/n if n else None, 'lastAt': all_records[-1]['timestamp'], 'episodeIds': [e['episodeId'] for e in all_records]})
        if all_records[0].get('missionType') == 'supply_run':
            groups[-1].update(missionType='supply_run', cargoUnits=all_records[0]['cargoUnits'],
                cargoCollected=count('cargoCollected'), regrouped=count('regrouped'), returnRouteReached=count('returnRouteReached'),
                returnedTogether=count('returnedTogether'), suppliesDelivered=sum(e['suppliesDelivered'] for e in rows),
                meanDamage=sum(e['damageTaken'] for e in rows)/n if n else None)
    return sorted(groups, key=lambda g: g['lastAt'], reverse=True)

def fact_catalog(snapshot):
    facts = []
    def add(identifier, text):
        facts.append({'id': identifier, 'text': text})
    sample_count = sum(len(p['points']) for r in snapshot['runs'] for p in r['policies'])
    add('research-coverage', f"Days Gone Quiet research feed: {len(snapshot['runs'])} configured runs and {sample_count} recorded reward samples. Early Rick, prison, barn and Sentinel run families are discovered automatically; folders without a saved configuration are deferred. Reward scales differ between tasks and are not a shared capability score.")
    for mode in ('training', 'evaluation', 'scripted_demo'):
        groups = [g for g in snapshot['cooperation']['groups'] if g['mode'] == mode and g.get('missionType') != 'supply_run']
        n = sum(g['completed'] for g in groups)
        wins = sum(g['successes'] for g in groups)
        label = {'training':'Training', 'evaluation':'Saved-policy evaluation', 'scripted_demo':'Scripted demonstration'}[mode]
        add(mode + '-outcomes', f'Cooperation mission — {label}: {wins} mission completions in {n} completed episodes. Interrupted episodes are excluded. Different configurations are listed separately in the dashboard.')
        for key, label2 in [('routeReported','Scout reported a safe route'), ('routeReached','Rick reached the reported route'), ('guardianCleared','Negan cleared a threat')]:
            total = sum(g[key] for g in groups)
            add(mode + '-' + key, f'Cooperation mission — {label}: {label2} in {total} of {n} completed episodes.')
        supply_groups = [g for g in snapshot['cooperation']['groups'] if g['mode'] == mode and g.get('missionType') == 'supply_run']
        completed = sum(g['completed'] for g in supply_groups)
        successes = sum(g['successes'] for g in supply_groups)
        delivered = sum(g['suppliesDelivered'] for g in supply_groups)
        add('supply-' + mode + '-outcomes', f'Supply Run — {label}: {successes} successful round trips in {completed} completed episodes; {delivered} supply units delivered. Success requires cargo retrieval, the return route, and all three survivors home. These episodes are separate from the original cooperation mission; interrupted episodes are excluded.')
    for r in snapshot['runs']:
        details = '; '.join(f"{p['name']}: {p['checkpointSteps'] if p['checkpointSteps'] is not None else 'no saved'} checkpoint steps / {p['targetSteps']} configured target, {len(p['points'])} reward samples" for p in r['policies'])
        add('run-' + r['id'], r['id'] + ' (' + r['kind'].replace('_',' ') + '). ' + details + '. Training reward is not mission success; reaching the step target is not proof of mastery.')
    add('evidence-boundary', 'Scripted demonstrations and mechanics validation do not establish learned cooperation. Completing the mission requires all three roles by design; no matched baseline has yet measured a causal improvement from cooperation.')
    return facts

def build_snapshot(results, telemetry):
    runs = export_runs(results)
    if not runs:
        raise ValueError('No training records found; preserving published data.')
    episodes, sources, partial = export_episodes(telemetry)
    snapshot = {'schemaVersion': 2, 'sourceRepository': 'https://github.com/dane-anderson/days_gone_quiet', 'sourceCommit': '953c63518c142ab8f540dc433503c185bb973736', 'scope': 'Automatically exported training records and separately classified episode outcomes. No controlled cooperation improvement is claimed.', 'metric': TAG, 'runs': runs, 'cooperation': {'groups': group_episodes(episodes), 'episodes': episodes, 'sources': sources, 'partialFilesDeferred': partial}}
    snapshot['facts'] = fact_catalog(snapshot)
    snapshot['snapshotHash'] = fingerprint(snapshot)
    snapshot['exportedAt'] = now()
    return snapshot

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--results', type=Path, action='append', required=True)
    parser.add_argument('--telemetry', type=Path, action='append', default=[])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = build_snapshot(args.results, args.telemetry)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'runs': len(data['runs']), 'episodes': len(data['cooperation']['episodes']), 'snapshotHash': data['snapshotHash']}))
