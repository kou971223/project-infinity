import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';
import {BASELINE,validatePolicy,loadBackend} from '../continuity/backend.js';
import {proposals,research,prepare,normalize,hash,compile,evaluate} from '../continuity/runtime-research.js';
import {packageRecord} from '../continuity/publish-record.js';
import {brief,createContinuityApplication} from '../continuity/service.js';
const GOOD={preferGpu:true,recoverProbe:true,recoverLoad:true};
for(const p of [null,{},[],{...GOOD,exec:'process.exit()'},{...GOOD,preferGpu:1}])test('unsafe policy shape '+JSON.stringify(p),()=>assert.throws(()=>validatePolicy(p)));
test('GPU failure falls back exactly once',async()=>{const calls=[];const r=await loadBackend(GOOD,{probe:async()=>true,load:async d=>{calls.push(d);if(d==='webgpu')throw Error();return {};}});assert.equal(r.device,'wasm');assert.deepEqual(calls,['webgpu','wasm']);});
test('probe rejection can recover without GPU load',async()=>{const r=await loadBackend(GOOD,{probe:async()=>{throw Error()},load:async()=>({})});assert.equal(r.device,'wasm');});
test('CPU user choice is a hard invariant',async()=>{const r=await loadBackend(GOOD,{mode:'cpu',probe:()=>{throw Error('DO_NOT_PROBE')},load:async d=>{assert.equal(d,'wasm');return {}}});assert.equal(r.device,'wasm');});
test('both failures terminate without infinite retry',async()=>{let count=0;await assert.rejects(loadBackend(GOOD,{probe:async()=>true,load:async()=>{count++;throw Error()}}));assert.equal(count,2);});
test('eight unique executable configurations',()=>assert.equal(new Set(proposals().map(hash)).size,8));
test('known current backend vulnerability has measurable scope',async()=>{const old=await evaluate(BASELINE,'a'),good=await evaluate(GOOD,'b');assert.equal(old.passed,9);assert.equal(good.passed,12);});
test('hypothesis reaches fixed fresh confirmatory test',async()=>{const r=await research(BASELINE);assert.equal(r.decision,'ADOPT_BOUNDED_RUNTIME');assert.equal(r.comparisons[0].regressions,0);assert.notEqual(...r.seedsRevealedAfterDecision);});
test('already improved program does not invent improvement',async()=>assert.equal((await research(GOOD)).decision,'NO_CHANGE'));
function temp(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'pinf-runtime-'));fs.mkdirSync(path.join(d,'web'));fs.writeFileSync(path.join(d,'web/backend-policy.json'),JSON.stringify(BASELINE));return d;}
test('release revalidates and writes actual compiled source',async()=>{const d=temp();try{const r=await research(BASELINE),x=await prepare(d,r);assert.equal(x.written,true);assert.equal(fs.readFileSync(path.join(d,'web/backend-policy.js'),'utf8'),compile(GOOD));assert.deepEqual(x.record.previousProgram,normalize(BASELINE));}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('candidate post-evaluation tampering cannot be released',async()=>{const d=temp();try{const r=await research(BASELINE);r.candidate.recoverLoad=false;await assert.rejects(prepare(d,r),/STALE_OR_MUTATED/);}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('self-declared adoption does not waive real tests',async()=>{const d=temp();try{const r=await research(BASELINE);r.candidate={...BASELINE};r.candidateHash=hash(r.candidate);await assert.rejects(prepare(d,r),/RELEASE_CHECK_FAILED/);}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('threshold manipulation does not pass publication',async()=>{const d=temp();try{const r=await research(BASELINE);r.protocol={...r.protocol,minGain:0};await assert.rejects(prepare(d,r));}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('brief status never upgrades scope',()=>{const x=brief(packageRecord({schema:'PINF-BACKEND-REPORT-1',decision:'ADOPT_BOUNDED_RUNTIME'},{schema:'PINF-SOURCES-1',items:[],sourceCount:2},true,'12','push'));assert.equal(x.overallProjectAccepted,false);assert.throws(()=>brief({schema:'PASS'}));});
test('read-only status records failure truthfully',async()=>{let calls=0;const server=await createContinuityApplication({factory:async()=>http.createServer((q,r)=>r.end('old')),fetcher:async()=>{calls++;throw Error('unavailable')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const root='http://127.0.0.1:'+server.address().port;const a=await (await fetch(root+'/api/runtime/status')).json();assert.equal(a.available,false);assert.equal((await (await fetch(root+'/health')).json()).version,'0.6.0');}finally{await new Promise(r=>server.close(r));}});

test('publication cannot mark a rejection applied',()=>assert.throws(()=>packageRecord({schema:'PINF-BACKEND-REPORT-1',decision:'REJECT'},{schema:'PINF-SOURCES-1'},true,'12','push')));
test('status hash detects upstream record tampering',()=>{const r=packageRecord({schema:'PINF-BACKEND-REPORT-1',decision:'NO_CHANGE'},{schema:'PINF-SOURCES-1',items:[]},false,'12','push');r.applied=true;assert.throws(()=>brief(r),/RECORD_HASH/);});
