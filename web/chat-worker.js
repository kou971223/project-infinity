// Public model assets only. Conversation text never leaves this Worker for inference.
import backendPolicy from './backend-policy.js';
import {loadBackend} from './model-backend.js';
import {loadAcceptedChat} from './chatlearn/client.js';
import {SYSTEM} from './chatlearn/config.js';
let generator=null,library=null,busy=false,loaded={source:'base'};
const progress=x=>self.postMessage(x);
self.onmessage=async({data})=>{
 if(busy)return self.postMessage({type:'error',message:'処理中です。停止してから再実行してください。'});
 busy=true;
 try{
  if(data.type==='load'){
   library=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   library.env.allowLocalModels=false;library.env.useBrowserCache=true;library.env.backends.onnx.wasm.numThreads=1;
   const update=await loadAcceptedChat(library,{forceBase:data.forceBase===true,progress});
   let device;
   if(update.generator){generator=update.generator;device='wasm';loaded={source:'trained',generation:update.manifest.generation,weightHash:update.manifest.weightHash,releaseHash:update.manifest.releaseHash,verifiedChunks:update.receipt.verifiedChunks};}
   else{
    const result=await loadBackend(backendPolicy,{mode:data.device==='cpu'?'cpu':'auto',
     probe:async()=>{if(!self.navigator?.gpu)return false;const a=await self.navigator.gpu.requestAdapter();return !!a?.features.has('shader-f16');},
     load:device=>library.pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{revision:'cc5cc01a65cc3ff17bdb73a7de33d879f62599b0',device,dtype:device==='webgpu'?'q4f16':'q8',progress_callback:p=>progress({type:'progress',file:p.file||'',progress:p.progress??null,status:p.status})}),
     notify:()=>progress({type:'progress',file:'GPU起動失敗：端末CPUで再試行',progress:null})});
    generator=result.generator;device=result.device;loaded={source:'base',reason:update.reason};
   }
   self.postMessage({type:'ready',device,model:loaded});
  }else if(data.type==='chat'){
   if(!generator)throw Error('最初に「端末内AIを起動」を押してください。');
   if(!Array.isArray(data.messages)||data.messages.length>12||data.messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>2000))throw Error('会話の入力が長すぎます。');
   let text='';const streamer=new library.TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:delta=>{text+=delta;self.postMessage({type:'delta',text});}});
   const output=await generator([{role:'system',content:SYSTEM},...data.messages],{max_new_tokens:128,do_sample:false,streamer});
   const reply=output[0]?.generated_text?.at(-1)?.content||text;
   if(typeof reply!=='string'||!reply.trim())throw Error('空の応答です。');
   self.postMessage({type:'done',text:reply,model:loaded});
  }
 }catch(e){self.postMessage({type:loaded.source==='trained'&&data.type==='chat'?'fallback_required':'error',message:String(e?.message||e).slice(0,500),model:loaded});}
 finally{busy=false;}
};
