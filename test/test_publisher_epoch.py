import base64,io,json,os,pathlib,sys,tempfile,unittest
from unittest.mock import patch
from contextlib import redirect_stdout
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'autonomy'))
import publish
from contracts import VERSION,seal
class PublisherEpoch(unittest.TestCase):
 def record(self):
  return seal({'schema':VERSION,'status':'error','runId':'123','attempt':'1','baseCommit':'a'*40,'parentRecordHash':None,'activeCheckpoint':None,'at':'2026-10-02T00:00:00Z','event':'push'})
 def env(self,r):return {'AUTONOMY_RECORD_B64':base64.b64encode(json.dumps(r).encode()).decode(),'GITHUB_SHA':'a'*40,'GITHUB_RUN_ID':'123'}
 def test_running_record_is_not_completion(self):
  r=self.record();r['status']='running';r=seal(r)
  with patch.dict(os.environ,self.env(r)),patch.object(publish,'call') as call:
   with self.assertRaisesRegex(ValueError,'INCOMPLETE_EXECUTION'):publish.main()
   call.assert_not_called()
 def test_origin_mismatch_fails_before_network(self):
  r=self.record();r['baseCommit']='b'*40;r=seal(r)
  with patch.dict(os.environ,self.env(r)),patch.object(publish,'call') as call:
   with self.assertRaisesRegex(ValueError,'JOB_ORIGIN'):publish.main()
   call.assert_not_called()
 def test_record_and_tree_use_same_immutable_parent(self):
  calls=[]
  def fake(endpoint,method='GET',body=None):
   calls.append((endpoint,method,body))
   if endpoint=='/git/ref/heads/research-records':return {'object':{'sha':'head'}}
   if endpoint=='/git/commits/head':return {'tree':{'sha':'tree'}}
   if endpoint=='/git/trees':return {'sha':'newtree'}
   if endpoint=='/git/commits':return {'sha':'newcommit'}
   if endpoint=='/git/refs/heads/research-records':return {}
   raise AssertionError(endpoint)
  with patch.dict(os.environ,self.env(self.record())),patch.object(publish,'call',fake),patch.object(publish,'blob_at',return_value=None) as blob,redirect_stdout(io.StringIO()):
   publish.main()
   blob.assert_called_once_with('autonomy/latest.json','head')
  self.assertEqual(calls[-1],('/git/refs/heads/research-records','PATCH',{'sha':'newcommit','force':False}))
 def test_stale_parent_does_not_publish(self):
  p=self.record()
  with patch.dict(os.environ,self.env(self.record())),patch.object(publish,'call',return_value={'object':{'sha':'head'}}) as call,patch.object(publish,'blob_at',return_value=p):
   # Distinct prior record, so this is not an idempotent replay.
   p['at']='earlier';p=seal(p)
   with patch.object(publish,'blob_at',return_value=p):
    with self.assertRaisesRegex(ValueError,'STALE_RESEARCH_PARENT'):publish.main()
   self.assertEqual(call.call_count,1)
if __name__=='__main__':unittest.main()
