// Public model downloads only. No hosted inference, user-data upload or automatic weight promotion.
import backendPolicy from './backend-policy.js';
import {loadBackend} from './model-backend.js';
let generator=null,library=null,busy=false;
const tell=(type,fields={})=>self.postMessage({type,...fields});
self.onmessage=async({data})=>{
 if(busy)return tell('error',{message:'処理中です。停止してから再実行してください。'});
 busy=true;
 try{
  if(data.type==='load'){
   tell('phase',{message:'1/3 AIの実行エンジンを準備しています'});
   library=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   library.env.allowLocalModels=false;library.env.useBrowserCache=true;library.env.backends.onnx.wasm.numThreads=1;
   let last=0,downloaded=false;
   const result=await loadBackend(backendPolicy,{
    mode:data.device==='cpu'?'cpu':'auto',
    probe:async()=>{if(!self.navigator?.gpu)return false;const a=await self.navigator.gpu.requestAdapter();return !!a?.features.has('shader-f16');},
    load:device=>library.pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{
     revision:'cc5cc01a65cc3ff17bdb73a7de33d879f62599b0',device,
     // q4f16 is the smallest published ONNX variant at this pinned revision (~483 MB).
     // iPhone/iPad already route to WASM; use the same smaller weights there.
     dtype:'q4f16',
     progress_callback:p=>{const model=String(p.file||'').endsWith('.onnx');if(model&&p.status==='done'){downloaded=true;tell('phase',{message:'3/3 ダウンロード完了。会話用AIを初期化しています'});}else if(!downloaded&&p.status==='progress'&&(Date.now()-last>200||p.progress>=100)){last=Date.now();tell('progress',{file:p.file||'',progress:p.progress??null});}}
    }),
    notify:()=>{downloaded=false;tell('phase',{message:'GPUでの起動に失敗しました。CPU方式を準備しています'});}
   });generator=result.generator;tell('ready',{device:result.device});
  }else if(data.type==='chat'){
   if(!generator)throw Error('最初に端末内AIを起動してください。');
   if(!Array.isArray(data.messages)||!data.messages.length||data.messages.length>12||data.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>2000))throw Error('会話の入力が長すぎます。');
   const system='You are Project Infinity, a small local assistant. Reply briefly in Japanese. Distinguish facts from uncertainty. You cannot browse, execute arbitrary code or change your own weights. Separate research experiments are not evidence that your chat intelligence improved.';
   let remaining=1800;const recent=[];for(let i=data.messages.length-1;i>=0&&remaining>0;i--){const m=data.messages[i];const content=m.content.slice(-Math.min(remaining,1200));recent.unshift({role:m.role,content});remaining-=content.length;}
   while(recent.length>1&&recent[0].role!=='user')recent.shift();
   let text='';const streamer=new library.TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:delta=>{text+=delta;tell('delta',{text,turn:data.turn});}});
   const output=await generator([{role:'system',content:system},...recent],{max_new_tokens:64,do_sample:false,streamer});
   const reply=output[0]?.generated_text?.at(-1)?.content||text;
   if(typeof reply!=='string'||!reply.trim())throw Error('空の応答です。新しい会話で再実行してください。');
   tell('done',{text:reply,turn:data.turn});
  }else throw Error('不明な操作です。');
 }catch(e){tell('error',{message:String(e?.message||e).slice(0,500),turn:data.turn});}
 finally{busy=false;}
};
