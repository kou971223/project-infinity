import copy, importlib.util, pathlib, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('contracts',ROOT/'autonomy/contracts.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Autonomy(unittest.TestCase):
 def trial(self,seed=104729):return {'seed':seed,'before':[4.0]*12,'after':[3.98]*12,'anchorBefore':[3.0]*6,'anchorAfter':[3.01]*6,'parentHash':'base','candidateHash':m.digest([1.0]*896)}
 def report(self):return {'protocolHash':m.digest(m.POLICY),'parentHash':'base','basePretrainedHash':'base','trials':[self.trial(),self.trial(130363)],'candidateValues':[1.0]*896}
 def test_record_tamper(self):
  r=m.seal({'schema':m.VERSION,'a':1});m.verify_record(r);r['a']=2
  with self.assertRaises(ValueError):m.verify_record(r)
 def test_accept_recomputed(self):
  a,d=m.select_checkpoint(self.report(),None);self.assertEqual(a['generation'],1);self.assertEqual(d['decision'],'ADOPT_EXPERIMENTAL_RESEARCHER_NORM')
 def test_reject_does_not_inherit_failed_weights(self):
  r=self.report();r['trials'][1]['after']=[4.1]*12;a,d=m.select_checkpoint(r,None);self.assertIsNone(a);self.assertEqual(d['decision'],'REJECT_WEIGHT_UPDATE')
 def test_missing_replication(self):
  r=self.report();r['trials']=r['trials'][:1]
  with self.assertRaises(ValueError):m.select_checkpoint(r,None)
 def test_posthoc_criteria_denied(self):
  r=self.report();r['protocolHash']='relaxed'
  with self.assertRaises(ValueError):m.select_checkpoint(r,None)
 def test_post_eval_mutation(self):
  r=self.report();r['candidateValues']=[2.0]*896
  with self.assertRaises(ValueError):m.select_checkpoint(r,None)
 def test_nan_denied(self):
  r=self.report();r['trials'][0]['after'][0]=float('nan')
  with self.assertRaises(ValueError):m.select_checkpoint(r,None)
 def test_single_anchor_regression_denied(self):
  r=self.report();r['trials'][0]['anchorAfter'][0]=3.2;self.assertEqual(m.select_checkpoint(r,None)[1]['decision'],'REJECT_WEIGHT_UPDATE')
 def test_sibling_not_best_winner(self):
  r=self.report();r['trials'][0]['after']=[4.1]*12;self.assertEqual(m.select_checkpoint(r,None)[1]['decision'],'REJECT_WEIGHT_UPDATE')
 def test_claim_not_evidence(self):
  r=self.report();r['decision']='PASS';r['trials'][0]['after']=[5.0]*12;self.assertIsNone(m.select_checkpoint(r,None)[0])
 def test_checkpoint_wrong_model(self):
  a,_=m.select_checkpoint(self.report(),None);a['model']='unknown'
  with self.assertRaises(ValueError):m.check_active(a)
 def test_checkpoint_wrong_shape(self):
  a,_=m.select_checkpoint(self.report(),None);a['values']=[1.0]*895
  with self.assertRaises(ValueError):m.check_active(a)
 def test_next_generation(self):
  a,_=m.select_checkpoint(self.report(),None);r=self.report();r['parentHash']=a['weightHash'];r['candidateValues']=[1.01]*896
  for t in r['trials']:t['parentHash']=a['weightHash'];t['candidateHash']=m.digest(r['candidateValues'])
  b,_=m.select_checkpoint(r,a);self.assertEqual(b['generation'],2);self.assertEqual(b['parentHash'],a['weightHash'])
 def test_bad_patch_paths(self):
  for p in ['../secret','.github/workflows/ci.yml','autonomy/contracts.py','src/server.js','test/test_autonomy.py']:
   with self.assertRaises(ValueError):m.validate_patch({'path':p,'baseHash':'x','content':'x','hypothesis':'long enough hypothesis'},ROOT)
 def test_patch_requires_frozen_base(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'web/free-chat.js';p.parent.mkdir();p.write_text('old')
   x={'path':'web/free-chat.js','baseHash':m.digest(b'old'),'content':'new','hypothesis':'A concrete testable change.'};m.validate_patch(x,d);p.write_text('changed')
   with self.assertRaises(ValueError):m.validate_patch(x,d)
 def test_permissions_not_in_patch_schema(self):
  with self.assertRaises(ValueError):m.validate_patch({'authority':'admin'},ROOT)
if __name__=='__main__':unittest.main()
