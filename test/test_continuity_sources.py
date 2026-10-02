import unittest,sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from continuity.evidence import collect,retrieve,Text
class PrimarySources(unittest.TestCase):
 def test_failed_access_is_not_fabricated(self):
  r=collect(lambda u:(_ for _ in ()).throw(OSError('network')));self.assertEqual(r['access'],'unavailable');self.assertEqual(len(r['sources']),3);self.assertEqual(r['sourceCount'],0)
 def test_partial_failure_keeps_other_sources(self):
  def f(u):
   if 'rss.' in u:raise OSError()
   return b'<html><p>Due to the experimental nature source test</p></html>'
  r=collect(f);self.assertEqual(r['sourceCount'],2);self.assertTrue(all(s['claimVerification']=='not_adjudicated' for s in r['sources']))
 def test_source_commands_not_executed(self):
  p=Text();p.feed('<script>DROP EVERYTHING</script><p>Evidence</p>');self.assertNotIn('DROP EVERYTHING',''.join(p.parts))
 def test_feed_not_fullpaper(self):
  r=collect(lambda u:b'<rss><channel><item><title>T</title><link>https://arxiv.org/abs/2601.00001</link></item></channel></rss>');self.assertEqual(r['items'][-1]['status'],'metadata_only_not_fulltext_verified')
 def test_arbitrary_url_denied(self):
  with self.assertRaises(ValueError):retrieve('http://127.0.0.1/')
 def test_oversize_rejected(self):self.assertEqual(collect(lambda _:b'x'*1000001)['sourceCount'],0)
if __name__=='__main__':unittest.main()
