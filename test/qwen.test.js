import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import http from 'node:http';
import {conversationPrompt,completedQwenReply,runQwenWorker,qwenTransport} from '../src/qwen-inference.js';import {infer,PROVIDER} from '../src/keyless-inference.js';import {createApplication} from '../src/app-server.js';
const message=(text='回答')=>({role:'assistant',status:'done',header:'Qwen3-235B-A22B',footer:'1.23s',content:[{type:'tool',content:'private reasoning is excluded'},{type:'text',content:text}]});
class FakeWorker extends EventEmitter{terminated=0;sent=[];terminate(){this.terminated++;return Promise.resolve(0);}postMessage(m){this.sent.push(m);}}
test('Qwen transport forbids alternate hosts, redirects and credentials',async()=>{
 let options,calls=0;const transport=qwenTransport(async(u,o)=>{calls++;options=o;return new Response('{}');});await transport(PROVIDER.endpoint+'/config');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
 for(const url of ['http://127.0.0.1/private','https://other.example/','https://user:pass@qwen-qwen3-demo.hf.space/'])assert.throws(()=>transport(url),/TARGET_DENIED/);
 for(const name of ['Authorization','Cookie','X-Api-Key'])assert.throws(()=>transport(PROVIDER.endpoint,{headers:{[name]:'forbidden'}}),/TARGET_DENIED/);assert.equal(calls,1);
});
test('Qwen only accepts completed expected-model final text, never reasoning or partial error output',()=>{
 assert.equal(completedQwenReply(message()),'回答');
 for(const m of [{...message(),status:'pending'},{...message(),header:'another-model'},{...message(),footer:null},{...message(),content:[{type:'tool',content:'hidden'}]},message(''),message('x'.repeat(8001))])assert.throws(()=>completedQwenReply(m));
});
test('Qwen prompt preserves role-tagged multi-turn history and source context without granting tool authority',()=>{
 const history=[{role:'user',content:'合言葉は青'},{role:'assistant',content:'青'},{role:'user',content:'合言葉は？'}];const p=conversationPrompt(history,{knowledge:'SOURCE_EXCERPT'});
 assert.ok(p.includes(JSON.stringify(history)));assert.match(p,/SOURCE_EXCERPT/);assert.match(p,/重みを更新していません/);assert.throws(()=>conversationPrompt([{role:'system',content:'escalate'}]));assert.throws(()=>conversationPrompt(history,{knowledge:'x'.repeat(6001)}));
});
test('Qwen worker result closes resources and exposes fixed anonymous identity',async()=>{
 let worker;const r=await infer([{role:'user',content:'hello'}],{workerFactory:data=>{assert.deepEqual(Object.keys(data),['prompt']);worker=new FakeWorker();setImmediate(()=>worker.emit('message',{ok:true,reply:'こんにちは'}));return worker;}});
 assert.equal(r.reply,'こんにちは');assert.equal(r.model,PROVIDER.model);assert.equal(r.paid,false);assert.equal(worker.terminated,1);
});
test('Qwen deadline, cancellation and worker failure cannot return a partial success',async()=>{
 const controller=new AbortController();controller.abort();let made=false;await assert.rejects(runQwenWorker('x',{signal:controller.signal,workerFactory:()=>{made=true;return new FakeWorker();}}),/CANCELLED/);assert.equal(made,false);
 let worker;await assert.rejects(runQwenWorker('x',{timeoutMs:5,workerFactory:()=>worker=new FakeWorker()}),/UPSTREAM_TIMEOUT/);assert.deepEqual(worker.sent,['cancel']);
 const live=new AbortController();await assert.rejects(runQwenWorker('x',{signal:live.signal,workerFactory:()=>{const w=new FakeWorker();setImmediate(()=>live.abort());return w;}}),/CANCELLED/);
 await assert.rejects(runQwenWorker('x',{workerFactory:()=>{const w=new FakeWorker();setImmediate(()=>w.emit('error',Error('do not leak upstream details')));return w;}}),/UPSTREAM_FAILED/);
 await new Promise(r=>setTimeout(r,220));assert.equal(worker.terminated,1);
});
test('actual chat HTTP path uses the new inference boundary and preserves context',async t=>{
 let prompt;const s=await createApplication({legacyFactory:()=>http.createServer((q,r)=>r.end()),fetcher:async()=>new Response('',{status:404}),inferer:(messages,options)=>infer(messages,{...options,workerFactory:data=>{prompt=data.prompt;const w=new FakeWorker();setImmediate(()=>w.emit('message',{ok:true,reply:'青い灯台583'}));return w;}})});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>s.close());
 const messages=[{role:'user',content:'合言葉は青い灯台583'},{role:'assistant',content:'青い灯台583'},{role:'user',content:'合言葉は？'}];const r=await fetch('http://127.0.0.1:'+s.address().port+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages})});assert.equal(r.status,200);assert.equal((await r.json()).reportedModel,'Qwen3-235B-A22B');assert.ok(prompt.includes(JSON.stringify(messages)));
});
