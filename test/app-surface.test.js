import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {createApplication} from '../src/app-server.js';
async function app(t){const s=await createApplication({legacyFactory:()=>http.createServer((q,r)=>r.end('legacy')),fetcher:async()=>({ok:false,status:404})});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>s.close());return 'http://127.0.0.1:'+s.address().port;}
test('local chat landing serves without API credentials',async t=>{const b=await app(t),r=await fetch(b);assert.equal(r.status,200);const x=await r.text();assert.match(x,/font-size:16px/);assert.match(x,/端末内AI/);});
test('paid inference is unconditionally blocked in free surface',async t=>{const b=await app(t);assert.equal((await fetch(b+'/api/chat',{method:'POST'})).status,503);});
test('laboratory is preserved',async t=>{const b=await app(t);assert.equal(await (await fetch(b+'/lab')).text(),'legacy');});
test('status cannot claim overall completion',async t=>{const b=await app(t);const x=await(await fetch(b+'/api/free/status')).json();assert.equal(x.overallProjectAccepted,false);assert.equal(x.paidInferenceEnabled,false);assert.equal(x.research.available,false);});
test('worker URL cannot expose filesystem',async t=>{const b=await app(t);const x=await(await fetch(b+'/chat-worker.js')).text();assert.match(x,/cc5cc01a65cc3ff17bdb73a7de33d879f62599b0/);assert.doesNotMatch(x,/api\.openai\.com/);});
