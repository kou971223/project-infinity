// Network downloads public model assets; chat is not sent to an inference API.
let generator=null,library=null,busy=false;
self.onmessage=async({data})=>{
  if(busy)return self.postMessage({type:'error',message:'処理中です。停止してから再実行してください。'});
  busy=true;
  try{
    if(data.type==='load'){
      library=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
      library.env.allowLocalModels=false;library.env.useBrowserCache=true;
      library.env.backends.onnx.wasm.numThreads=1;
      let device='wasm';
      if(data.device!=='cpu'&&self.navigator?.gpu){const adapter=await self.navigator.gpu.requestAdapter();if(adapter?.features.has('shader-f16'))device='webgpu';}
      generator=await library.pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{
        revision:'cc5cc01a65cc3ff17bdb73a7de33d879f62599b0',device,dtype:device==='webgpu'?'q4f16':'q8',
        progress_callback:p=>self.postMessage({type:'progress',file:p.file||'',progress:p.progress??null,status:p.status})});
      self.postMessage({type:'ready',device});
    }else if(data.type==='chat'){
      if(!generator)throw new Error('最初に「端末内AIを起動」を押してください。');
      if(!Array.isArray(data.messages)||data.messages.length>12||data.messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>2000))throw new Error('会話の入力が長すぎます。');
      const system='You are Project Infinity, a small local assistant. Reply in Japanese. Be brief and honest about uncertainty. This chat runs locally. You cannot modify your model weights, execute code, deploy apps or browse the web in this conversation. Separate background research experiments must not be claimed as your own proven intelligence gain.';
      let text='';const streamer=new library.TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,
        callback_function:delta=>{text+=delta;self.postMessage({type:'delta',text});}});
      const output=await generator([{role:'system',content:system},...data.messages],{max_new_tokens:128,do_sample:false,streamer});
      const reply=output[0]?.generated_text?.at(-1)?.content||text;
      if(typeof reply!=='string'||!reply.trim())throw new Error('空の応答です。新しい会話で再実行してください。');
      self.postMessage({type:'done',text:reply});
    }
  }catch(e){self.postMessage({type:'error',message:String(e?.message||e).slice(0,500)});}
  finally{busy=false;}
};
