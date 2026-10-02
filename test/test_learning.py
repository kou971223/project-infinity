import importlib.util, pathlib, tempfile, unittest
p=pathlib.Path(__file__).resolve().parents[1]/'experiments/local_research.py'
s=importlib.util.spec_from_file_location('learning',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
class LearningContract(unittest.TestCase):
    def test_split_changes(self): self.assertNotEqual(m.corpus(1,8),m.corpus(2,8))
    def test_determinism(self): self.assertEqual(m.corpus(1,8),m.corpus(1,8))
    def test_no_weights_no_support(self): self.assertEqual(m.judge([2.]*12,[1.]*12,[2.]*6,[2.]*6,False)['decision'],'NOT_SUPPORTED')
    def test_regression_blocks(self): self.assertEqual(m.judge([2.]*12,[1.]*12,[2.]*6,[3.]*6,True)['decision'],'NOT_SUPPORTED')
    def test_never_self_promotes(self): self.assertFalse(m.judge([2.]*12,[1.]*12,[2.]*6,[2.]*6,True)['promoted'])
    def test_missing(self):
        with self.assertRaises(ValueError): m.judge([2.],[1.],[2.]*6,[2.]*6,True)
    def test_nan(self):
        with self.assertRaises(ValueError): m.judge([float('nan')]*12,[1.]*12,[2.]*6,[2.]*6,True)
    def test_atomic(self):
        with tempfile.TemporaryDirectory() as t:
            out=pathlib.Path(t)/'x.json'; m.save(out,{'ok':True}); self.assertEqual(m.json.loads(out.read_text()),{'ok':True})
if __name__=='__main__': unittest.main()
