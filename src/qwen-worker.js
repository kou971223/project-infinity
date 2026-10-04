import {parentPort,workerData} from 'node:worker_threads';
import {Client} from '@gradio/client';
import {completedQwenReply,qwenTransport} from './qwen-inference.js';
import {PROVIDER,InferenceError} from './keyless-inference.js';
let client,job,cancelled=false;
globalThis.fetch=qwenTransport(globalThis.fetch);
parentPort.on('message',async value=>{if(value!=='cancel')return;cancelled=true;try{await job?.cancel();}catch{}finally{client?.close();process.exit(0);}});
try{
 client=await Client.connect(PROVIDER.endpoint,{events:['data','status'],record_history:false,credentials:'omit'});
 if(cancelled)throw new InferenceError('CANCELLED');
 job=client.submit('/add_message',[workerData.prompt,{model:PROVIDER.model,sys_prompt:'You are a helpful assistant.',thinking_budget:1}]);
 let final,complete=false,bytes=0,events=0;
 for await(const event of job){
  if(++events>2000)throw new InferenceError('UPSTREAM_TOO_LARGE');
  if(event.type==='data'){
   const size=Buffer.byteLength(JSON.stringify(event.data));bytes+=size;
   if(size>160000||bytes>12000000)throw new InferenceError('UPSTREAM_TOO_LARGE');
   const item=event.data?.find(v=>Array.isArray(v?.value)&&v.value.some(m=>m?.role==='assistant'));
   if(item)final=item.value.at(-1);
  }
  if(event.type==='status'&&event.stage==='error')throw new InferenceError(/queue|quota|rate|limit/i.test(String(event.message))?'UPSTREAM_BUSY':'UPSTREAM_FAILED');
  if(event.type==='status'&&event.stage==='complete'){complete=true;break;}
 }
 if(!complete)throw new InferenceError('INCOMPLETE_UPSTREAM');
 parentPort.postMessage({ok:true,reply:completedQwenReply(final)});
}catch(e){parentPort.postMessage({ok:false,error:e instanceof InferenceError?e.message:'UPSTREAM_FAILED'});}
finally{client?.close();parentPort.close();}
