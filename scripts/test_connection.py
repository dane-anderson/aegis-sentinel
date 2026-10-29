"""Regression checks for evidence separation, duplicate counting and AI grounding."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from export_research import export_episodes, export_runs, group_episodes, clean_episode, build_snapshot, fact_catalog
from athena_brief import generate_brief

class EvidenceTests(unittest.TestCase):
    def episode(self, mode='training', outcome='success', suffix=1):
        return {'schemaVersion':1,'sessionId':'a'*32,'episodeId':'a'*32+'-'+str(suffix),'runId':'sentinel-test','timestamp':'2026-10-09T23:00:00Z','mode':mode,'eventType':'finish','outcome':outcome,'environmentFingerprint':'b'*64,'scene':'SentinelCooperation','condition':'full_team','round':suffix,'seed':1440,'blockedRoute':0,'safeRoute':1,'randomized':True,'routeReported':True,'routeReached':True,'guardianCleared':True,'allSurvived':True,'durationSeconds':12.,'reportAt':2.,'routeAt':5.,'guardianAt':4.,'maxSeconds':90.,'walkerSpeed':1.,'walkerHealth':50.,'walkerCount':1,'agents':[{'role':role,'policy':'Sentinel'+role,'modelHash':'none','health':100.,'maximumHealth':100.,'reward':2.,'distance':10.,'kills':0,'alive':True} for role in ['Rick','Negan','Scout']]}
    def supply_episode(self, suffix=1, outcome='success'):
        e=self.episode(suffix=suffix,outcome=outcome)
        e.update(schemaVersion=2,missionType='supply_run',scene='SupplyRun',condition='supply_return',runId='sentinel-supply-test',stage='Deliver',cargoUnits=3,suppliesDelivered=3 if outcome=='success' else 0,cargoCollected=True,regrouped=True,returnRouteReached=True,returnedTogether=True,regroupAt=4.,collectedAt=6.,returnAt=9.,deliveredAt=12. if outcome=='success' else -1.,damageTaken=10.,guardianCleared=False)
        for a in e['agents']:a['policy']='Supply'+a['role']
        return e

    def test_supply_outcomes_are_separate_and_interruptions_excluded(self):
        records=[self.episode(suffix=1),self.supply_episode(suffix=2),self.supply_episode(suffix=3,outcome='timeout'),self.supply_episode(suffix=4,outcome='interrupted')]
        groups=group_episodes([clean_episode(e) for e in records])
        self.assertEqual(len(groups),2)
        supply=next(g for g in groups if g.get('missionType')=='supply_run')
        self.assertEqual((supply['completed'],supply['interrupted'],supply['successes'],supply['suppliesDelivered']),(2,1,1,3))
        self.assertEqual(supply['meanDamage'],10.)
        facts={f['id']:f['text'] for f in fact_catalog({'runs':[],'cooperation':{'groups':groups}})}
        self.assertIn('1 mission completions in 1 completed episodes',facts['training-outcomes'])
        self.assertIn('1 successful round trips in 2 completed episodes; 3 supply units delivered',facts['supply-training-outcomes'])

    def test_supply_eval_cases_keep_layouts_separate(self):
        a=self.supply_episode();a.update(mode='evaluation',scenario='case-01',layoutFingerprint='a'*64)
        b=self.supply_episode(suffix=2);b.update(mode='evaluation',scenario='case-02',layoutFingerprint='b'*64)
        groups=group_episodes([clean_episode(a),clean_episode(b)])
        self.assertEqual(len(groups),2)
        self.assertEqual({g['scenario'] for g in groups},{'case-01','case-02'})
        a['scenario']='/Users/private'
        with self.assertRaises(ValueError):clean_episode(a)

    def test_supply_requires_cargo_and_whole_team(self):
        for key,value in [('cargoCollected',False),('regrouped',False),('returnRouteReached',False),('returnedTogether',False),('suppliesDelivered',2),('damageTaken',float('nan'))]:
            e=self.supply_episode();e[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):clean_episode(e)
        e=self.supply_episode(outcome='death');e['suppliesDelivered']=3
        with self.assertRaises(ValueError):clean_episode(e)

    def test_latest_frozen_evaluation_is_required_and_failures_stay_scoped(self):
        from io import BytesIO
        old=self.supply_episode(outcome='timeout');old.update(mode='evaluation',stage='Collect',runId='sentinel-supply-old')
        new=self.supply_episode(suffix=2,outcome='timeout');new.update(mode='evaluation',stage='Regroup',runId='sentinel-supply-new',timestamp='2026-10-10T23:00:00Z')
        snapshot={'snapshotHash':'a'*64,'runs':[],'cooperation':{'groups':group_episodes([old,new]),'episodes':[old,new]}}
        snapshot['facts']=fact_catalog(snapshot)
        facts={f['id']:f['text'] for f in snapshot['facts']}
        newest='supply-evaluation-run-sentinel-supply-new'
        self.assertIn('Regroup: 1',facts[newest])
        self.assertNotIn('Collect',facts[newest])
        result={'done':True,'response':json.dumps({'trainingEvidenceId':'training-outcomes','contextEvidenceId':'research-coverage','nextExperiment':'improve_supply_bottleneck'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())) as call:
            brief=generate_brief(snapshot)
        choices=json.loads(call.call_args.args[0].data)['format']['properties']['nextExperiment']['enum']
        self.assertNotIn('evaluate_frozen',choices)
        self.assertIn(newest,{f['id'] for f in brief['findings']})
        self.assertLessEqual(len(brief['findings']),6)

    def test_supply_policy_family_and_public_allowlist(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_run(root,'sentinel-supply-smoke-v1','SupplyScout')
            runs=export_runs([Path(root)])
            self.assertEqual(runs[0]['kind'],'smoke_test')
        e=self.supply_episode();e['private_note']='Do not export me'
        self.assertNotIn('private_note',clean_episode(e))
        e['agents'][0]['policy']='SentinelRick'
        with self.assertRaises(ValueError):clean_episode(e)

    def test_athena_must_include_supply_training_outcome(self):
        from io import BytesIO
        ids=['training-outcomes','supply-training-outcomes','evidence-boundary','run-rick_v2','evaluation-outcomes','scripted_demo-outcomes','research-coverage']
        snapshot={'snapshotHash':'a'*64,'facts':[{'id':i,'text':i} for i in ids]}
        result={'done':True,'response':json.dumps({'trainingEvidenceId':'run-rick_v2','contextEvidenceId':'research-coverage','historyEvidenceId':'run-rick_v2','nextExperiment':'train_roles'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            brief=generate_brief(snapshot)
        self.assertLessEqual(len(brief['findings']),6)
        self.assertTrue(set(ids[:4]).issubset({f['id'] for f in brief['findings']}))

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
        result={'done':True,'response':json.dumps({'trainingEvidenceId':'training-outcomes','contextEvidenceId':'invented-success','nextExperiment':'train_roles'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            with self.assertRaises(ValueError):generate_brief(snapshot)
    def test_athena_exact_facts_preserved(self):
        facts=[{'id':key,'text':'Recorded '+key} for key in ['training-outcomes','evidence-boundary','evaluation-outcomes']]
        snapshot={'snapshotHash':'a'*64,'facts':facts}
        from io import BytesIO
        result={'done':True,'response':json.dumps({'trainingEvidenceId':'training-outcomes','contextEvidenceId':'evaluation-outcomes','nextExperiment':'train_roles'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            brief=generate_brief(snapshot)
        self.assertEqual(brief['findings'],facts)
        self.assertEqual(brief['sourceSnapshotHash'],snapshot['snapshotHash'])

    def write_run(self, root, name, policy):
        import yaml
        folder = Path(root, name)
        folder.mkdir()
        settings = {'trainer_type':'ppo', 'max_steps':1000, 'network_settings':{'hidden_units':128, 'num_layers':2}}
        (folder/'configuration.yaml').write_text(yaml.safe_dump({'behaviors':{policy:settings}}))
        return folder

    def test_discovers_earlier_and_future_runs_without_checkpoints(self):
        with tempfile.TemporaryDirectory() as root:
            for name, policy in [('rick_yard_v5','My Behavior'), ('prison-duo-v3','RickEscape'), ('barn-team-v3','NeganCombat'), ('sentinel-supplies-v1','SentinelScout')]:
                self.write_run(root, name, policy)
            self.write_run(root, 'private-experiment', 'My Behavior')
            Path(root, 'barn-team-pending').mkdir()
            runs = export_runs([Path(root)])
        self.assertEqual({r['id'] for r in runs}, {'rick_yard_v5','prison-duo-v3','barn-team-v3','sentinel-supplies-v1'})
        self.assertTrue(all(r['policies'][0]['checkpointSteps'] is None for r in runs))
        facts = fact_catalog({'runs':runs, 'cooperation':{'groups':[]}})
        self.assertTrue(any(f['id']=='run-rick_yard_v5' for f in facts))

    def test_wrong_policy_family_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_run(root, 'barn-team-v3', 'SentinelRick')
            with self.assertRaises(ValueError): export_runs([Path(root)])

    def test_duplicate_run_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            for root in (first, second): self.write_run(root, 'rick_v2', 'My Behavior')
            with self.assertRaises(ValueError): export_runs([Path(first), Path(second)])

    def test_athena_receives_and_must_reference_days_gone_quiet(self):
        from io import BytesIO
        facts=[{'id':key,'text':key} for key in ['training-outcomes','evidence-boundary','research-coverage','run-barn-team-v3']]
        snapshot={'snapshotHash':'a'*64,'facts':facts,'runs':[{'id':'barn-team-v3','kind':'training','policies':[{'name':'RickEscape','points':[]}]}]}
        result={'done':True,'response':json.dumps({'trainingEvidenceId':'training-outcomes','contextEvidenceId':'research-coverage','historyEvidenceId':'run-barn-team-v3','nextExperiment':'train_roles'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())) as call:
            brief=generate_brief(snapshot)
        body=json.loads(call.call_args.args[0].data)
        self.assertEqual(json.loads(body['prompt'])['runContext'][0]['id'], 'barn-team-v3')
        self.assertEqual(brief['findings'], facts)
        snapshot['facts'].append({'id':'evaluation-outcomes','text':'No evaluation'})
        result['response']=json.dumps({'trainingEvidenceId':'training-outcomes','contextEvidenceId':'evaluation-outcomes','nextExperiment':'train_roles'})
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            with self.assertRaises(ValueError): generate_brief(snapshot)

    def test_required_context_survives_model_prioritization(self):
        from io import BytesIO
        extras = ['evaluation-outcomes', 'scripted_demo-outcomes', 'research-coverage']
        facts = [{'id':key,'text':key} for key in extras + ['training-outcomes','evidence-boundary','run-rick_v2']]
        snapshot = {'snapshotHash':'a'*64,'facts':facts}
        result = {'done':True,'response':json.dumps({'trainingEvidenceId':'run-rick_v2','contextEvidenceId':'research-coverage','historyEvidenceId':'run-rick_v2','nextExperiment':'evaluate_frozen'})}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(result).encode())):
            brief = generate_brief(snapshot)
        self.assertLessEqual(len(brief['findings']), 6)
        self.assertTrue({'training-outcomes','evidence-boundary','run-rick_v2'}.issubset({f['id'] for f in brief['findings']}))

if __name__=='__main__':unittest.main()
