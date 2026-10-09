"""Export local evidence, ask local Athena, and optionally publish only approved data files."""
import argparse
import fcntl
import json
import os
import subprocess
import tempfile
from pathlib import Path
from export_research import build_snapshot, now
from athena_brief import generate_brief

ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = ['public/data/research.json', 'public/data/athena.json']
COMMIT_MESSAGE = 'Update Sentinel evidence and Athena briefing'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as f:
        json.dump(data, f, indent=2, allow_nan=False)
        f.write('\n')
        name = f.name
    os.replace(name, path)

def preflight():
    if git('branch','--show-current') != 'main':
        raise RuntimeError('Publish requires the existing main branch.')
    if git('status','--porcelain'):
        raise RuntimeError('Working tree has edits; publish those intentionally before automatic sync.')
    git('fetch','origin','main')
    local = git('rev-parse','HEAD')
    remote = git('rev-parse','origin/main')
    if local == remote:
        return
    # Retry only our own previously committed data updates after a network failure.
    if git('merge-base', 'HEAD', 'origin/main') != remote:
        raise RuntimeError('Remote changed; refusing automatic merge or overwrite.')
    for commit in git('rev-list','origin/main..HEAD').splitlines():
        names = set(git('diff-tree','--no-commit-id','--name-only','-r',commit).splitlines())
        if git('show','-s','--format=%s',commit) != COMMIT_MESSAGE or not names.issubset(set(DATA_FILES)):
            raise RuntimeError('Unpublished implementation commit requires manual review.')
    git('push','origin','main')

def sync(config, publish=False):
    if publish:
        preflight()
    snapshot = build_snapshot([Path(p) for p in config['results']], [Path(p) for p in config['telemetry']])
    snapshot_file, brief_file = [ROOT / p for p in DATA_FILES]
    previous = json.loads(snapshot_file.read_text()) if snapshot_file.exists() else {}
    old_brief = json.loads(brief_file.read_text()) if brief_file.exists() else {}
    changed = previous.get('snapshotHash') != snapshot['snapshotHash']
    if not changed:
        snapshot = previous
        if old_brief.get('status') == 'ready' and old_brief.get('sourceSnapshotHash') == snapshot['snapshotHash']:
            return {'status':'unchanged', 'snapshotHash':snapshot['snapshotHash']}
    try:
        brief = generate_brief(snapshot, model=config.get('model','qwen3.5:9b'))
    except Exception as error:
        # Publish valid measurements even if AI is unavailable. Never disguise fallback as AI.
        brief = {'schemaVersion':1, 'status':'unavailable', 'sourceSnapshotHash':snapshot['snapshotHash'], 'generatedAt':now(), 'model':config.get('model','qwen3.5:9b'), 'method':'Local AI unavailable. Verified facts remain available in the dashboard.', 'findings':[], 'nextExperiment':None, 'errorType':type(error).__name__}
    if not changed and brief['status']=='unavailable' and old_brief.get('status')=='unavailable':
        return {'status':'athena_unavailable', 'errorType':brief['errorType'], 'snapshotHash':snapshot['snapshotHash']}
    atomic_json(snapshot_file,snapshot)
    atomic_json(brief_file,brief)
    subprocess.run([os.sys.executable,str(ROOT/'scripts/check_site.py')],check=True)
    if publish:
        git('add','--',*DATA_FILES)
        if git('diff','--cached','--name-only'):
            git('commit','-m',COMMIT_MESSAGE,'--',*DATA_FILES)
            git('push','origin','main')
    return {'status':'published' if publish else 'prepared', 'athena':brief['status'], 'runs':len(snapshot['runs']), 'episodes':len(snapshot['cooperation']['episodes']), 'snapshotHash':snapshot['snapshotHash']}

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',type=Path,required=True)
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args()
    # Per-checkout lock prevents the training launcher and scheduled sync racing.
    lock_path=ROOT/git('rev-parse','--git-dir')/'sentinel-sync.lock'
    with lock_path.open('w') as lock:
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status':'already_running'}))
            raise SystemExit(0)
        print(json.dumps(sync(json.loads(args.config.read_text()),args.publish)))
