import importlib.util, json, pathlib, tempfile, unittest, urllib.error
SPEC=importlib.util.spec_from_file_location('loop',pathlib.Path(__file__).resolve().parents[1]/'autonomy/loop.py')
m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)
SHA='a'*40
TEXT='export function value(x) { return x + 1; }\n'
SNAP={'src/app-server.js':{'content':TEXT,'sha256':m.digest(TEXT)}}

def proposal(**kw):
    x={'hypothesis':'Repair observed arithmetic boundary in a test fixture.',
       'changes':[{'path':'src/app-server.js','before':'x + 1','after':'x + 2'}]}
    x.update(kw);return json.dumps(x)

def record(previous=None, question=None, **kw):
    return m.build_record(previous,question,[],SHA,**kw)

class AutonomyContract(unittest.TestCase):
    def test_record_integrity(self):
        x=record();self.assertEqual(m.verify(x),x)
    def test_record_tamper(self):
        x=record();x['generation']=99
        with self.assertRaisesRegex(ValueError,'HASH'):m.verify(x)
    def test_not_self_promotable(self):
        x=record();x['promoted']=True;x=m.seal(x)
        with self.assertRaisesRegex(ValueError,'AUTHORITY'):m.verify(x)
    def test_completion_cannot_be_claimed(self):
        x=record();x['overallProjectAccepted']=True;x=m.seal(x)
        with self.assertRaisesRegex(ValueError,'AUTHORITY'):m.verify(x)
    def test_three_generation_linkage(self):
        a=record();b=record(a);c=record(b)
        self.assertEqual((a['generation'],b['generation'],c['generation']),(1,2,3))
        self.assertEqual(c['parentRecordHash'],b['recordHash'])
        self.assertEqual(b['parentRecordHash'],a['recordHash'])
        self.assertFalse(c['promoted'])
    def test_no_change_is_not_improvement(self):
        x=record(raw='NO_CHANGE');self.assertEqual(x['decision'],'NO_CHANGE');self.assertFalse(x['promoted'])
    def test_rejected_candidate_remembered(self):
        x=record(question={'fingerprint':'bad'},raw='invalid',error='schema')
        y=record(x);self.assertEqual(y['history'][0]['reason'],'schema')
    def test_history_is_bounded(self):
        x=None
        for _ in range(40):x=record(x)
        self.assertEqual(x['generation'],40);self.assertEqual(len(x['history']),24)
    def test_valid_source_patch(self):
        c=m.freeze_proposal(proposal(),SNAP,SHA)
        self.assertIn('x + 2',c['changes'][0]['content']);self.assertEqual(m.verify_candidate(c,SNAP),c)
    def test_candidate_mutation_after_freeze(self):
        c=m.freeze_proposal(proposal(),SNAP,SHA);c['changes'][0]['content']='malicious'
        with self.assertRaisesRegex(ValueError,'FROZEN'):m.verify_candidate(c,SNAP)
    def test_parent_source_must_match(self):
        c=m.freeze_proposal(proposal(),SNAP,SHA)
        changed={'src/app-server.js':{'content':TEXT+'// changed','sha256':'x'}}
        with self.assertRaisesRegex(ValueError,'PARENT'):m.verify_candidate(c,changed)
    def test_acceptance_change_rejected(self):
        c=m.freeze_proposal(proposal(),SNAP,SHA);c['protocol']={};c['candidateHash']=m.digest({k:v for k,v in c.items() if k!='candidateHash'})
        with self.assertRaisesRegex(ValueError,'FROZEN'):m.verify_candidate(c,SNAP)
    def test_unsafe_paths(self):
        for name in ['../src/app-server.js','.github/workflows/ci.yml','src/evaluation.js','autonomy/loop.py','.env','/etc/passwd','web/../src/app-server.js']:
            with self.subTest(name=name),self.assertRaises(ValueError):
                m.freeze_proposal(proposal(changes=[{'path':name,'before':'x + 1','after':'x + 2'}]),SNAP,SHA)
    def test_injected_authority(self):
        with self.assertRaisesRegex(ValueError,'SCHEMA'):m.freeze_proposal(proposal(promote=True),SNAP,SHA)
    def test_unmatched_anchor(self):
        with self.assertRaisesRegex(ValueError,'ANCHOR'):m.freeze_proposal(proposal(changes=[{'path':'src/app-server.js','before':'missing','after':'x'}]),SNAP,SHA)
    def test_repeated_anchor(self):
        snap={'src/app-server.js':{'content':TEXT+TEXT}}
        with self.assertRaisesRegex(ValueError,'ANCHOR'):m.freeze_proposal(proposal(),snap,SHA)
    def test_empty_change(self):
        with self.assertRaisesRegex(ValueError,'NO_CHANGE'):m.freeze_proposal(proposal(changes=[{'path':'src/app-server.js','before':'x + 1','after':'x + 1'}]),SNAP,SHA)
    def test_duplicate_paths(self):
        c=json.loads(proposal());c['changes']*=2
        with self.assertRaisesRegex(ValueError,'PATH'):m.freeze_proposal(json.dumps(c),SNAP,SHA)
    def test_model_prose_not_silently_repaired(self):
        with self.assertRaises(ValueError):m.freeze_proposal('Here is a valid result '+proposal(),SNAP,SHA)
    def test_bad_commit(self):
        with self.assertRaisesRegex(ValueError,'SHA'):m.freeze_proposal(proposal(),SNAP,'main')
    def test_max_size(self):
        with self.assertRaisesRegex(ValueError,'SIZE'):m.freeze_proposal('x'*17000,SNAP,SHA)
    def test_syntax_check_does_not_execute(self):
        with tempfile.TemporaryDirectory() as t:
            marker=str(pathlib.Path(t)/'must-not-exist')
            raw=proposal(changes=[{'path':'src/app-server.js','before':TEXT,
             'after':"import fs from 'node:fs'; fs.writeFileSync("+json.dumps(marker)+",'oops');"}])
            c=m.freeze_proposal(raw,SNAP,SHA)
            self.assertEqual(m.syntax_check(c,SNAP)['status'],'passed')
            self.assertFalse(pathlib.Path(marker).exists())
    def test_bad_javascript_rejected(self):
        c=m.freeze_proposal(proposal(changes=[{'path':'src/app-server.js','before':'x + 1','after':'{ not valid ]'}]),SNAP,SHA)
        self.assertEqual(m.syntax_check(c,SNAP)['status'],'failed')
    def test_static_signal_not_fact(self):
        q=m.select_question(SNAP,None,[],None);self.assertEqual(q['evidenceType'],'static_signal_not_confirmed_bug')
    def test_research_agenda_remembers_prior_attempt(self):
        q=m.select_question(SNAP,None,[],None);prev=record(question=q,raw='NO_CHANGE')
        self.assertIsNone(m.select_question(SNAP,prev,[],None))
    def test_source_change_reopens_question(self):
        q=m.select_question(SNAP,None,[],None);prev=record(question=q,raw='NO_CHANGE')
        new={'src/app-server.js':{'content':TEXT+'// new','sha256':'changed'}}
        self.assertIsNotNone(m.select_question(new,prev,[],None))
    def test_bad_memory_does_not_reset(self):
        with self.assertRaisesRegex(ValueError,'MEMORY_UNVERIFIED'):m.read_inputs(lambda _:b'corrupted')
    def test_unavailable_memory_does_not_reset(self):
        def unavailable(url):raise urllib.error.HTTPError(url,503,'unavailable',{},None)
        with self.assertRaisesRegex(ValueError,'MEMORY_ACCESS'):m.read_inputs(unavailable)
    def test_absent_initial_memory_bootstraps(self):
        def absent(url):raise urllib.error.HTTPError(url,404,'absent',{},None)
        prev,legacy,papers,sources,status=m.read_inputs(absent)
        self.assertIsNone(prev);self.assertEqual(status,'bootstrap_absent_404')
        self.assertTrue(all(s['access']=='unavailable' for s in sources))
    def test_xml_entities_refused(self):
        with self.assertRaisesRegex(ValueError,'UNSAFE_XML'):m.parse_feed(b'<!DOCTYPE feed [<!ENTITY e SYSTEM "file:///etc/passwd">]><feed/>')
    def test_paper_metadata_scope(self):
        raw=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2601.00001v1</id><title>Research</title><summary>A proposal</summary></entry></feed>'
        papers=m.parse_feed(raw);self.assertIn('not verified',papers[0]['verification'])
    def test_unknown_url_not_fetched(self):
        with self.assertRaisesRegex(ValueError,'ALLOWLISTED'):m.fetch_bytes('http://127.0.0.1/')
    def test_symlink_not_read(self):
        with tempfile.TemporaryDirectory() as t:
            p=pathlib.Path(t);(p/'src').mkdir();(p/'src/app-server.js').symlink_to('/etc/passwd')
            with self.assertRaisesRegex(ValueError,'SYMLINK'):m.snapshot(p)

if __name__=='__main__':unittest.main()
