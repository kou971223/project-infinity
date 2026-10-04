import importlib.util,pathlib,unittest,copy
spec=importlib.util.spec_from_file_location('research_memory_cycle',pathlib.Path(__file__).resolve().parents[1]/'research/cycle.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ResearchMemory(unittest.TestCase):
 def program(self):return dict(task='percentage',expression=['div',['mul',['var','amount'],['var','rate']],['const','100']],hypothesis='exact percentage')
 def record(self):
  p=self.program();r=dict(schema='PINF-RESEARCH-2',baseCommit=m.os.environ.get('GITHUB_SHA','local'),runId=m.os.environ.get('GITHUB_RUN_ID','local'),at=m.now(),parents=dict(knowledge=None,programs=None),cards=[],task='percentage',programCandidate=p,validationCompleted=True,knowledgeEvidence=dict(verifiedCards=[]));r['frozenHash']=m.digest({k:r[k] for k in ['cards','task','programCandidate']});cs=m.cases('percentage',123);r['programEvidence']=dict(protocol='PINF-PROGRAM-TEST-1',candidateHash=m.digest(p),seed=123,nodes=m.program_nodes(p),cases=[dict(c,reply=c['expected']) for c in cs],passed=True);return r
 def test_independent_oracle_known_values(self):
  self.assertEqual(m.oracle('percentage',dict(amount='0.1',rate='20')),'1/50');self.assertEqual(m.oracle('discount',dict(amount='1000',rate='20')),'800');self.assertEqual(m.oracle('mean',dict(a='1',b='2',c='4')),'7/3');self.assertEqual(m.oracle('rectangle',dict(width='1.5',height='2.5')),'15/4')
 def test_frozen_candidate_cannot_change(self):
  r=self.record();r['programCandidate']['expression']=['const','1']
  with self.assertRaises(ValueError):m.checked(r)
 def test_fake_pass_or_replaced_hidden_sample_rejected(self):
  for mutate in [lambda e:e['cases'].pop(),lambda e:e['cases'][5].update(reply='wrong'),lambda e:e.update(seed=55)]:
   r=self.record();mutate(r['programEvidence'])
   with self.assertRaises(ValueError):m.checked(r)
 def test_valid_publication_and_parent_lock(self):
  r=self.record();paths=m.publication(r,dict(knowledge=None,programs=None));self.assertEqual(paths['programs/active.json']['generation'],1);self.assertEqual(paths['programs/status.json']['decision'],'ADOPT')
  with self.assertRaises(ValueError):m.publication(self.record(),dict(knowledge=None,programs=paths['programs/active.json']))
 def test_no_false_generation_for_equal_cost(self):
  r=self.record();p=m.publication(r,dict(knowledge=None,programs=None))['programs/active.json'];r=self.record();r['parents']['programs']=p['artifactHash'];paths=m.publication(r,dict(knowledge=None,programs=p));self.assertNotIn('programs/active.json',paths);self.assertEqual(paths['programs/status.json']['decision'],'NO_GAIN')
 def test_source_failures_not_invented(self):
  def fail(url):raise OSError('offline')
  cards,errors=m.collect(fail);self.assertEqual(cards,[]);self.assertEqual(len(errors),3)
 def test_new_random_cases_are_reproducible(self):
  self.assertEqual(len(m.cases('mean',1)),64);self.assertEqual(m.cases('mean',1),m.cases('mean',1));self.assertNotEqual(m.cases('mean',1),m.cases('mean',2))
 def test_capability_cannot_add_code_or_permissions(self):
  for expr in [['eval','process.env'],['var','__proto__']]:
   p=self.program();p['expression']=expr
   with self.assertRaises(ValueError):m.program_nodes(p)

 def test_publication_rejects_foreign_job(self):
  r=self.record();r['runId']='foreign-job'
  with self.assertRaises(ValueError):m.checked(r)
