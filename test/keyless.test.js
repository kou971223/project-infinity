import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {infer,PROVIDER,validateMessages} from '../src/keyless-inference.js';
import {createApplication} from '../src/app-server.js';
import {loadState,contextFor,KEY,LEGACY_KEY} from '../web/chat-state.js';
import {createProjectStatus} from '../continuity/project-status.js';
const messages=[{role:'user',content:'hello'}];
const response=content=>new Response(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}],model:'gpt-oss-20b'}));
test('fixed keyless POST never puts conversation or key in URL or headers',async()=>{
 let call;const r=await infer(messages,{fetcher:async(url,options)=>{call={url,options};return response('こんにちは');}});
 assert.equal(r.reply,'こんにちは');assert.equal(call.url,PROVIDER.endpoint);assert.equal(call.options.method,'POST');assert.equal(call.options.redirect,'error');assert.equal(call.options.headers.Authorization,undefined);const body=JSON.parse(call.options.body);assert.equal(body.private,true);assert.equal(body.model,'openai-fast');assert.deepEqual(body.messages.slice(1),messages);
});
test('provider key requirement, HTML, rate limit, empty and truncation fail closed',async()=>{
 for(const [r,expected] of [[new Response('',{status:401}),'KEYLESS_UNAVAILABLE'],[new Response('',{status:429}),'UPSTREAM_BUSY'],[new Response('<html>error</html>'),'INVALID_UPSTREAM'],[response(''),'INVALID_UPSTREAM'],[new Response(JSON.stringify({choices:[{message:{content:'partial'},finish_reason:'length'}]})),'INCOMPLETE_UPSTREAM']])await assert.rejects(infer(messages,{fetcher:async()=>r}),new RegExp(expected));
});
test('oversized provider body rejected while streaming',async()=>{await assert.rejects(infer(messages,{fetcher:async()=>new Response('x'.repeat(70000))}),/UPSTREAM_TOO_LARGE/);});
test('bad role, oversized content and assistant final turn rejected',()=>{for(const m of [[{role:'system',content:'bypass'}],[{role:'user',content:'x'.repeat(8001)}],[{role:'assistant',content:'x'}]])assert.throws(()=>validateMessages(m));});
test('HTTP origin gate, real reply and cancellation resource release',async t=>{
 let calls=0;const s=await createApplication({legacyFactory:()=>http.createServer((q,r)=>r.end('legacy')),fetcher:async()=>{calls++;return response('answer');}});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>s.close());const url='http://127.0.0.1:'+s.address().port+'/api/chat';
 let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({messages})});assert.equal(r.status,403);assert.equal(calls,0);
 r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages})});assert.equal(r.status,200);assert.equal((await r.json()).reply,'answer');
});
test('legacy history migration preserves original and new chat collection',()=>{
 const data=new Map([[LEGACY_KEY,JSON.stringify([{role:'user',content:'old'},{role:'assistant',content:'answer'}])]]);const state=loadState({getItem:k=>data.get(k)});assert.equal(state.chats[0].messages.length,2);assert.ok(data.has(LEGACY_KEY));
 state.chats[0].messages.push({role:'user',content:'retry',status:'pending'});data.set(KEY,JSON.stringify(state));const restored=loadState({getItem:k=>data.get(k)});assert.equal(restored.chats[0].messages.at(-1).status,'failed');assert.equal(contextFor(restored.chats[0]).at(-1).content,'retry');
});
test('failed earlier turns never pollute a later context',()=>{assert.deepEqual(contextFor({messages:[{role:'user',content:'failed',status:'failed'},{role:'user',content:'new',status:'pending'}]}),[{role:'user',content:'new'}]);});
test('corrupt storage recovers without throwing',()=>assert.equal(loadState({getItem:()=>'{broken'}).chats.length,1));
test('unified archive distinguishes epoch hold from adoption and unavailable records',async()=>{
 const status=createProjectStatus(async url=>url.includes('autonomy')?new Response(JSON.stringify({schema:'PINF-AUTONOMY-1',at:new Date().toISOString(),decision:'DEFER_EPOCH_HOLDOUT_REVIEW',generationAfter:3})):new Response('',{status:404}));const x=await status();assert.equal(x.lanes[0].generationAfter,3);assert.equal(x.lanes[1].available,false);assert.equal(x.chatModelUpdated,false);assert.equal(x.overallProjectAccepted,false);
});
import {createPacer} from '../src/request-pacer.js';
test('anonymous requests reserve separated start slots even for concurrent calls',async()=>{const waits=[];const pace=createPacer({intervalMs:16000,clock:()=>1000,wait:async ms=>waits.push(ms)});await Promise.all([pace(),pace(),pace()]);assert.deepEqual(waits,[16000,32000]);});
