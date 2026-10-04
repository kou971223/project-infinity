import json,os,pathlib,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'autonomy'))
import keyless_source as source
from contracts import digest
class KeylessSource(unittest.TestCase):
 def record(self):return {'schema':source.SCHEMA,'baseCommit':'a'*40,'decision':'ADOPT'}
 def test_no_self_promotion(self):
  with patch.dict(os.environ,{'GITHUB_SHA':'a'*40}):
   with self.assertRaisesRegex(ValueError,'MISSING_CANDIDATE'):source.validate(self.record())
 def test_wrong_commit(self):
  with patch.dict(os.environ,{'GITHUB_SHA':'b'*40}):
   with self.assertRaisesRegex(ValueError,'RECORD_ORIGIN'):source.validate(self.record())
 def test_mutation(self):
  r=self.record();r.update(patch={'path':'test/evaluator.py'},candidateHash='wrong')
  with patch.dict(os.environ,{'GITHUB_SHA':'a'*40}):
   with self.assertRaisesRegex(ValueError,'CANDIDATE_MUTATED'):source.validate(r)
 def test_smoke_pass_never_promotes(self):
  r=self.record();r['patch']={'example':'only data'};r['candidateHash']=digest(r['patch'])
  with patch.dict(os.environ,{'GITHUB_SHA':'a'*40}),patch.object(source,'verify_patch_in_docker',return_value={'status':'executed','results':{k:{'exitCode':0,'limit':None} for k in ['baseline','candidate']}}):
   x=source.validate(r);self.assertEqual(x['decision'],'REVIEW_REQUIRED');self.assertFalse(x['applied'])
if __name__=='__main__':unittest.main()
