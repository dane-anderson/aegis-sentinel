"""Validate public assets, evidence integrity, and Athena snapshot linkage."""
import json, math, re
from pathlib import Path
from html.parser import HTMLParser
from export_research import fingerprint, group_episodes, fact_catalog
root=Path(__file__).resolve().parents[1]
public=root/'public'
class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.files=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag in ('img','script','link','video','source','track'):
            for key in ('src','href','poster'):
                if a.get(key,'').startswith('/'):self.files.append(a[key])
p=SiteParser();p.feed((public/'index.html').read_text())
assert len(p.ids)==len(set(p.ids)), 'Duplicate element IDs'
for path in p.files:assert (public/path.lstrip('/')).is_file(), path
j=json.loads((public/'data/research.json').read_text())
assert j['schemaVersion']==2 and j['runs']
assert j['snapshotHash']==fingerprint({k:v for k,v in j.items() if k not in {'snapshotHash','exportedAt'}})
assert j['cooperation']['groups']==group_episodes(j['cooperation']['episodes'])
assert j['facts']==fact_catalog(j)
count=0
for r in j['runs']:
    assert r['policies']
    assert all(re.fullmatch('[0-9a-f]{64}',s['sha256']) for s in r['sources'])
    for policy in r['policies']:
        assert policy['checkpointSteps'] is None or policy['checkpointSteps']>=0
        assert policy['targetSteps']>0
        points=policy['points']
        assert all(math.isfinite(p['value']) and p['step']>=0 for p in points)
        assert all(a['step']<=b['step'] for a,b in zip(points,points[1:]))
        count+=len(points)
b=json.loads((public/'data/athena.json').read_text())
assert b['sourceSnapshotHash']==j['snapshotHash']
assert b['status'] in {'ready','unavailable'}
facts={f['id']:f for f in j['facts']}
for f in b['findings']:assert f==facts[f['id']], 'Athena finding differs from measured evidence'
for path in public.rglob('*'):
    if path.suffix in ('.json','.js','.html','.css'):
        content=path.read_text()
        assert '/Users/' not in content and 'api_key' not in content.lower(), f'Private path or credential marker: {path}'
print(f"PASS: {len(j['runs'])} runs, {count} reward samples, {len(j['cooperation']['episodes'])} distinct episodes; Athena {b['status']} and snapshot linkage verified.")
