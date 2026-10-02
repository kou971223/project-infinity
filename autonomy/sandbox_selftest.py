"""Integration FIXTURE, not a model improvement or external scientific replication."""
import json,pathlib,tempfile
from sandbox import one_run, capture, IMAGE

def main():
    code,_=capture(['docker','pull',IMAGE],timeout=100)
    if code:raise RuntimeError('IMAGE_PULL_FAILED')
    with tempfile.TemporaryDirectory() as d:
        p=pathlib.Path(d);(p/'src').mkdir();(p/'test').mkdir()
        (p/'package.json').write_text(json.dumps({'type':'module','scripts':{'test':'node --test'}}))
        (p/'src/app-server.js').write_text('export const value=1;')
        (p/'test/fixture.test.js').write_text("""import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {value} from '../src/app-server.js';
        test('fixture output',()=>assert.equal(value,1));
        test('no publisher credential',()=>assert.equal(process.env.GH_TOKEN,undefined));
        test('root is read-only',()=>assert.throws(()=>fs.writeFileSync('/etc/pinf-test','x')));
        test('network unavailable',async()=>{await assert.rejects(fetch('https://example.com',{signal:AbortSignal.timeout(1000)}));});
        """)
        parent=one_run(p,timeout=12)
        bad=one_run(p,{'changes':[{'path':'src/app-server.js','content':'export const value=2;'}]},timeout=12)
        loop=one_run(p,{'changes':[{'path':'src/app-server.js','content':'while(true){}; export const value=1;'}]},timeout=5)
        assert parent['status']=='passed',parent
        assert bad['status']=='failed',bad
        assert loop['status']=='failed',loop
        print(json.dumps({'fixture':'sandbox-selftest','passingFixture':'passed','badOutput':'rejected',
                          'endlessCode':'terminated','credentials':'not passed','network':'blocked',
                          'notAnAIImprovement':True}))
if __name__=='__main__':main()
