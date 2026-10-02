import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'autonomy'))
from source_sandbox import bounded_process
from contracts import digest,expand_edit
import tempfile
class SourceSandbox(unittest.TestCase):
 def test_output_bound(self):
  r=bounded_process([sys.executable,'-c','print("x"*50000)'],max_output=1000)
  self.assertEqual(r['limit'],'OUTPUT_LIMIT')
 def test_timeout(self):
  r=bounded_process([sys.executable,'-c','import time;time.sleep(5)'],timeout=.1)
  self.assertEqual(r['limit'],'TIMEOUT')
 def test_output_success(self):
  r=bounded_process([sys.executable,'-c','print("ok")'])
  self.assertEqual(r['exitCode'],0);self.assertEqual(r['logHash'],digest(b'ok\n'))
 def test_unique_edit(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'web/free-chat.js';p.parent.mkdir();p.write_text('const x=1;')
   e={'path':'web/free-chat.js','baseHash':digest(p.read_bytes()),'find':'x=1','replace':'x=2','hypothesis':'A testable source correction.'}
   self.assertEqual(expand_edit(e,d)['content'],'const x=2;')
 def test_ambiguous_edit(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'web/free-chat.js';p.parent.mkdir();p.write_text('x;x')
   e={'path':'web/free-chat.js','baseHash':digest(p.read_bytes()),'find':'x','replace':'y','hypothesis':'A testable source correction.'}
   with self.assertRaises(ValueError):expand_edit(e,d)
if __name__=='__main__':unittest.main()
