import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {summarize,createAutonomyApplication} from '../autonomy/app.js';
const sample={schema:'PINF-AUTONOMY-1',runId:'123',at:'2026-10-02T00:00:00Z',event:'push',runStatus:'completed',decision:'REJECT_WEIGHT_UPDATE',generationBefore:0,generationAfter:0,sourceStatus:'rejected',literatureAccess:'unavailable'};
test('never treat trigger registration as schedule execution',()=>assert.equal(summarize(sample).event,'push'));
test('status cannot claim overall acceptance or chat weight promotion',()=>{const r=summarize({...sample,overallProjectAccepted:true,chatModelUpdated:true});assert.equal(r.overallProjectAccepted,false);assert.equal(r.chatModelUpdated,false)});
test('reject malformed record',()=>assert.throws(()=>summarize({schema:'other'})));
test('ignore untrusted source URLs',()=>assert.equal(summarize({...sample,sourceBranch:'https://attacker'}).sourceBranch,null));
test('readonly evidence server works and preserves existing endpoints',async()=>{
 const factory=()=>http.createServer((q,r)=>r.end('legacy'));
 const server=await createAutonomyApplication({factory,fetcher:async()=>new Response(JSON.stringify(sample))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await (await fetch(base+'/health')).json()).version,'0.5.0');assert.equal((await (await fetch(base+'/api/autonomy/status')).json()).available,true);assert.equal(await (await fetch(base+'/other')).text(),'legacy');}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
