"""Regression checks for evidence separation, duplicate counting and AI grounding."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from export_research import export_episodes, group_episodes, clean_episode, build_snapshot
from athena_brief import generate_brief

class EvidenceTests(unittest.TestCase):
    def episode(self, mode='training', outcome='success', suffix=1):
        return {'schemaVersion':1,'sessionId':'a'*32,'episodeId':'a'*32+'-'+str(suffix),'runId':'sentinel-test','timestamp':'2026-10-09T23:00:00Z','mode':mode,'eventType':'finish','outcome':outcome,'environmentFingerprint':'b'*64,'scene':'SentinelCooperation','condition':'full_team','round':suffix,'seed':1440,'blockedRoute':0,'safeRoute':1,'randomized':True,'routeReported':True,'routeReached':True,'guardianCleared':True,'allSurvived':True,'durationSeconds':12.,'reportAt':2.,'routeAt':5.,'guardianAt':4.,'maxSeconds':90.,'walkerSpeed':1.,'walkerHealth':50.,'walkerCount':1,'agents':[{'role':role,'policy':'Sentinel'+role,'modelHash':'none','health':100.,'maximumHealth':100.,'reward':2.,'distance':10.,'kills':0,'alive':True} for role in ['Rick','Negan','Scout']]}
    def test_duplicates_and_partial_write(self):
        with tempfile.TemporaryDirectory() as folder:
            record=self.episode(); line=json.dumps(record)+'\n'
            Path(folder,'one.jsonl').write_text(line+line+'{"eventType":')
            episodes,sources,partial=export_episodes([Path(folder)])
            self.assertEqual(len(episodes),1);self.assertEqual(partial,1)
            self.assertEqual(group_episodes(episodes)[0]['completed'],1)
    def test_modes_interruptions_and_configs_are_separate(self):
        records=[self.episode(),self.episode('scripted_demo',suffix=2),self.episode(outcome='interrupted',suffix=3),self.episode('validation',suffix=4)]
        groups=group_episodes([clean_episode(e) for e in records])
        train=next(g for g in groups if g['mode']=='training')
        self.assertEqual(train['completed'],1);self.assertEqual(train['interrupted'],1);self.assertEqual(train['successes'],1)
        changed=self.episode(suffix=5);changed['walkerSpeed']=3.
        self.assertEqual(len(group_episodes([clean_episode(records[0]),clean_episode(changed)])),2)
    def test_failed_episode_denominator(self):
        failed=self.episode(outcome='death',suffix=2);failed['allSurvived']=False
        group=group_episodes([clean_episode(self.episode()),clean_episode(failed)])[0]
        self.assertEqual((group['successes'],group['completed'],group['allSurvived']),(1,2,1))
    def test_invalid_success_rejected(self):
        e=self.episode();e['routeReached']=False
        with self.assertRaises(ValueError):clean_episode(e)
    def test_private_field_rejected(self):
        e=self.episode();e['scene']='/Users/private/scene'
        with self.assertRaises(ValueError):clean_episode(e)
    def test_conflicting_duplicate_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            a=self.episode();b=copy.deepcopy(a);b['durationSeconds']=99.
            Path(folder,'one.jsonl').write_text(json.dumps(a)+'\n'+json.dumps(b)+'\n')
            with self.assertRaises(ValueError):export_episodes([Path(folder)])
    def test_missing_results_rejected(self):
        with self.assertRaises(ValueError):build_snapshot([Path('/does-not-exist')],[])
    def test_athena_cannot_invent_evidence(self):
        snapshot={'snapshotHash':'a'*64,'facts':[{'id':key,'text':key} for key in ['training-outcomes','evidence-boundary','evaluation-outcomes']]}
        from io import BytesIO
        result={'done':True,'response':json.dumps({'evidenceIds':['training-outcomes','evidence-boundary','invented-success'],'nextExperiment':'train_roles'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            with self.assertRaises(ValueError):generate_brief(snapshot)
    def test_athena_exact_facts_preserved(self):
        facts=[{'id':key,'text':'Recorded '+key} for key in ['training-outcomes','evidence-boundary','evaluation-outcomes']]
        snapshot={'snapshotHash':'a'*64,'facts':facts}
        from io import BytesIO
        result={'done':True,'response':json.dumps({'evidenceIds':[f['id'] for f in facts],'nextExperiment':'train_roles'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            brief=generate_brief(snapshot)
        self.assertEqual(brief['findings'],facts)
        self.assertEqual(brief['sourceSnapshotHash'],snapshot['snapshotHash'])

if __name__=='__main__':unittest.main()
