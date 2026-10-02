"""Measure on the actual deployment backend, rather than substituting native ORT.
The native/WASM discrepancy is retained as a separate diagnostic, not relabeled Pass.
This server exposes only the two fixed, already hash-verified model files to localhost.
"""
from __future__ import annotations
import http.server, json, pathlib, threading
from playwright.sync_api import sync_playwright
SCRIPT=r'''async ({lane,model,revision,system,targets,anchors,prompts})=>{
 const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
 lib.env.allowLocalModels=false;lib.env.useBrowserCache=false;lib.env.useCustomCache=true;
 lib.env.backends.onnx.wasm.numThreads=1;
 const expected=`https://huggingface.co/${model}/resolve/${revision}/onnx/model_quantized.onnx`;
 let modelIntercepted=false;
 lib.env.customCache={async match(request){const url=typeof request==='string'?request:request.url;
  if(url===expected){modelIntercepted=true;return fetch('/'+lane+'.onnx');}return undefined;},async put(){}};
 const pipe=await lib.pipeline('text-generation',model,{revision,device:'wasm',dtype:'q8'});
 if(!modelIntercepted)throw Error('MODEL_BYTES_NOT_USED');
 async function loss(text){
  const encoded=pipe.tokenizer(text,{add_special_tokens:false,truncation:true,max_length:64});
  const ids=Array.from(encoded.input_ids.data,Number);
  const output=await pipe.model(encoded),logits=output.logits;
  if(logits.dims.length!==3||logits.dims[0]!==1||logits.dims[1]!==ids.length)throw Error('LOGITS_SHAPE');
  const vocab=logits.dims[2],data=logits.data;let sum=0;
  for(let i=0;i<ids.length-1;i++){
   const off=i*vocab;let max=-Infinity;
   for(let k=0;k<vocab;k++)max=Math.max(max,Number(data[off+k]));
   let denom=0;for(let k=0;k<vocab;k++)denom+=Math.exp(Number(data[off+k])-max);
   sum+=Math.log(denom)+max-Number(data[off+ids[i+1]]);
  }
  const value=sum/(ids.length-1);if(!Number.isFinite(value))throw Error('NONFINITE_LOSS');
  function dispose(x){if(!x)return;if(typeof x.dispose==='function')x.dispose();else if(typeof x==='object')Object.values(x).forEach(dispose);}
  dispose(output);return value;
 }
 const result={target:[],anchors:[],behavior:[],modelBytesIntercepted:true};
 for(const text of targets)result.target.push(await loss(text));
 for(const text of anchors)result.anchors.push(await loss(text));
 for(const prompt of prompts){
  const out=await pipe([{role:'system',content:system},{role:'user',content:prompt}],{max_new_tokens:24,do_sample:false,repetition_penalty:1.1});
  result.behavior.push(out[0].generated_text.at(-1).content);
 }
 await pipe.dispose();return result;
}'''
def measure_wasm(original, candidate, targets, anchors, behavior, system, model, revision):
 files={'/baseline.onnx':pathlib.Path(original),'/candidate.onnx':pathlib.Path(candidate)}
 class Handler(http.server.BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_GET(self):
   if self.path=='/':
    self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<!doctype html><title>Isolated measurement</title>');return
   p=files.get(self.path)
   if p is None:self.send_error(404);return
   self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(p.stat().st_size));self.end_headers()
   with p.open('rb') as f:
    while (b:=f.read(1048576)):self.wfile.write(b)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 results=[]
 try:
  with sync_playwright() as p:
   for lane in ['baseline','candidate']:
    browser=p.chromium.launch(headless=True,args=['--disable-dev-shm-usage'])
    try:
     page=browser.new_page();page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
     result=page.evaluate(SCRIPT,{'lane':lane,'model':model,'revision':revision,'system':system,'targets':targets,'anchors':anchors,'prompts':[p for p,_ in behavior]})
     print('ACTUAL_WASM_MEASUREMENT',lane,json.dumps(result,ensure_ascii=False),flush=True);results.append(result)
    finally:browser.close()
  return results
 finally:server.shutdown();server.server_close();thread.join(timeout=5)
