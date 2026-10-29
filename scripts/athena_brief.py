"""Local model selects and prioritizes verified findings; public values stay exact."""
import json
import urllib.request
from export_research import now

EXPERIMENTS = {
    'train_roles': 'Continue the three role policies, then evaluate frozen models on held-out routes. Compare mission outcomes and the Scout → Rick handoff, not reward alone.',
    'evaluate_frozen': 'Freeze and fingerprint all three models. Record separate evaluation episodes with documented seeds and settings before making a reliability claim.',
    'design_baseline': 'Design a matched cooperation comparison that keeps the objective achievable in both conditions. Removing a required mission step would confound the comparison.'
}

def generate_brief(snapshot, model='qwen3.5:9b', endpoint='http://127.0.0.1:11434'):
    ids = [f['id'] for f in snapshot['facts']]
    schema = {'type':'object', 'properties': {'evidenceIds': {'type':'array', 'items': {'type':'string', 'enum':ids}, 'minItems':3, 'maxItems':6}, 'nextExperiment': {'type':'string', 'enum':list(EXPERIMENTS)}}, 'required':['evidenceIds','nextExperiment'], 'additionalProperties':False}
    legacy_ids = [f['id'] for f in snapshot['facts'] if f['id'].startswith('run-') and not f['id'].startswith('run-sentinel-')]
    if legacy_ids:
        schema['properties']['historyEvidenceId'] = {'type':'string', 'enum':legacy_ids}
        schema['required'].append('historyEvidenceId')
    body = {'model':model, 'stream':False, 'think':False, 'keep_alive':0, 'format':schema, 'options':{'temperature':0, 'num_predict':512, 'num_ctx':16384}, 'system':'You are Athena, a research reviewer for Project Sentinel and Days Gone Quiet. Read only the supplied evidence. Select 3 to 6 distinct findings that best explain current progress, include evidence-boundary and at least one training finding. When earlier Days Gone Quiet runs are supplied, choose one in historyEvidenceId. Required training outcomes and interpretation limits are attached by the application. Review early Rick, prison, barn and Sentinel training in context; do not compare reward magnitudes across different tasks. Choose the most useful next experiment. Scripted demonstrations never establish learned cooperation. Return only the requested JSON.', 'prompt':json.dumps({'facts':snapshot['facts'], 'experimentOptions':EXPERIMENTS, 'episodeGroups':snapshot.get('cooperation',{}).get('groups',[]), 'recentEpisodes':[e for e in snapshot.get('cooperation',{}).get('episodes',[]) if e['mode'] in {'training','evaluation','scripted_demo'}][-12:], 'runContext':[{'id':r['id'],'kind':r['kind'],'environment':r.get('environment'),'policies':[{k:v for k,v in p.items() if k!='points'} | {'recentRewardSamples':p['points'][-5:]} for p in r['policies']]} for r in snapshot.get('runs',[])]})}
    request = urllib.request.Request(endpoint.rstrip('/')+'/api/generate', data=json.dumps(body).encode(), headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.load(response)
    if not result.get('done'):
        raise ValueError('Athena generation incomplete')
    selected = json.loads(result['response'])
    chosen = selected['evidenceIds']
    if not isinstance(chosen, list) or not 3 <= len(chosen) <= 6 or len(set(chosen)) != len(chosen) or not all(i in ids for i in chosen):
        raise ValueError('Athena returned unsupported evidence references')
    required = [i for i in ('training-outcomes', 'evidence-boundary') if i in ids]
    if legacy_ids:
        history = selected.get('historyEvidenceId')
        if history not in legacy_ids:
            raise ValueError('Athena omitted the Days Gone Quiet training history')
        required.append(history)
    # Keep mandatory context even when the model prioritizes different findings.
    extras = [i for i in chosen if i not in required][:6-len(required)]
    keep = set(required + extras)
    chosen = [i for i in chosen if i in keep] + [i for i in required if i not in chosen]
    experiment = selected['nextExperiment']
    if experiment not in EXPERIMENTS:
        raise ValueError('Athena returned an unsupported next experiment')
    facts = {f['id']:f for f in snapshot['facts']}
    return {'schemaVersion':1, 'status':'ready', 'sourceSnapshotHash':snapshot['snapshotHash'], 'generatedAt':now(), 'model':model, 'method':'AI-prioritized findings with required training and interpretation context; wording and numbers come from the verified evidence catalog. Batch briefing, not live chat.', 'findings':[facts[i] for i in chosen], 'nextExperiment':EXPERIMENTS[experiment]}
