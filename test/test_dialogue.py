import importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('dialogue',pathlib.Path(__file__).resolve().parents[1]/'evolution/cycle.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DialogueGate(unittest.TestCase):
 def evidence(self):return dict(protocol=m.PROTOCOL,pairs=[dict(expected='42',baseline=dict(ok=True,reply='42',ms=1000),candidate=dict(ok=True,reply='42',ms=1)) for _ in range(8)])
 def test_latency_gain_requires_zero_regression(self):
  e=self.evidence();self.assertTrue(m.judge(e));e['pairs'][0]['candidate']['reply']='43';self.assertFalse(m.judge(e))
 def test_outage_is_not_quality_gain(self):
  e=self.evidence();e['pairs'][0]['baseline']['ok']=False;self.assertFalse(m.judge(e))
 def test_missing_samples_and_changed_contract_fail(self):
  e=self.evidence();e['pairs'].pop();self.assertFalse(m.judge(e));e=self.evidence();e['protocol']='loose';self.assertFalse(m.judge(e))
 def test_oracle_samples_are_reproducible_and_seed_sensitive(self):
  a=m.cases('exact-integer-v1',123);self.assertEqual(len(a),8);self.assertEqual(a,m.cases('exact-integer-v1',123));self.assertNotEqual(a,m.cases('exact-integer-v1',124))
