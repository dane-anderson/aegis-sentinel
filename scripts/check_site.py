"""Validate the static package and public research snapshot with the standard library."""
import hashlib, json, math, re
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
public=root/'public'
class SiteParser(HTMLParser):
    ids=[]
    files=[]
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
assert j['schemaVersion']==1 and len(j['runs'])==3
count=0
for r in j['runs']:
    assert {p['name'] for p in r['policies']}=={'RickEscape','NeganCombat'}
    assert all(re.fullmatch('[0-9a-f]{64}',s['sha256']) for s in r['sources'])
    for policy in r['policies']:
        assert 0<policy['checkpointSteps'] and 0<policy['targetSteps']
        points=policy['points']; assert points
        assert all(math.isfinite(p['value']) and p['step']>=0 for p in points)
        assert all(a['step']<=b['step'] for a,b in zip(points,points[1:]))
        count+=len(points)
assert count==938, f'Unexpected sample count: {count}; update after reviewing a new snapshot'
for path in public.rglob('*'):
    if path.suffix in ('.json','.js','.html','.css'):
        text=path.read_text()
        assert '/Users/' not in text and 'api_key' not in text.lower(), f'Private path or credential marker: {path}'
print(f'PASS: {len(p.files)} local asset references, 3 runs, 6 policy records, {count} samples, no private path or API-key markers.')
