"""Non-promoting diagnostic: compare identical inputs across native and browser runtimes.
No gate changes or accepted manifests. Existing failed results remain failed.
"""
import gc, importlib.util, json, pathlib, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('bridge',ROOT/'chatlearn/evaluate.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
import onnxruntime as ort
from transformers import AutoTokenizer
from huggingface_hub import hf_hub_download
from playwright.sync_api import sync_playwright
start=time.monotonic()
file=hf_hub_download(m.MODEL,'onnx/model_quantized.onnx',revision=m.REVISION)
t=AutoTokenizer.from_pretrained(m.MODEL,revision=m.REVISION,trust_remote_code=False)
original_behavior=m.BEHAVIOR[:];m.BEHAVIOR=m.BEHAVIOR[:2];m.ANCHORS=m.ANCHORS[:2]
targets=['The observation is recorded. A candidate is tested against a frozen baseline.']
record={'scope':'runtime-diagnostic-only-not-acceptance','model':m.MODEL,'revision':m.REVISION,'onnxruntime':ort.__version__,'native':{}}
record['nativeTokens']=[t.apply_chat_template([{'role':'system','content':m.SYSTEM},{'role':'user','content':p}],tokenize=True,add_generation_prompt=True) for p,_ in m.BEHAVIOR]
original=ort.InferenceSession
for name,level in [('all',ort.GraphOptimizationLevel.ORT_ENABLE_ALL),('disabled',ort.GraphOptimizationLevel.ORT_DISABLE_ALL)]:
 def create(*args,**kwargs):
  kwargs['sess_options'].graph_optimization_level=level
  return original(*args,**kwargs)
 ort.InferenceSession=create
 record['native'][name]=m.evaluate_model(file,t,targets)
 print('NATIVE_DIAGNOSTIC',name,json.dumps(record['native'][name],ensure_ascii=False),flush=True)
ort.InferenceSession=original
gc.collect()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--disable-dev-shm-usage']);page=b.new_page()
 page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded')
 browser=page.evaluate('''async ({system,model,revision,prompts})=>{
   const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   lib.env.allowLocalModels=false;lib.env.backends.onnx.wasm.numThreads=1;
   const pipe=await lib.pipeline('text-generation',model,{revision,device:'wasm',dtype:'q8'});
   const out=[];
   for(const prompt of prompts){
     const messages=[{role:'system',content:system},{role:'user',content:prompt}];
     const ids=pipe.tokenizer.apply_chat_template(messages,{tokenize:true,add_generation_prompt:true,return_tensor:false});
     const result=await pipe(messages,{max_new_tokens:24,do_sample:false,repetition_penalty:1.0});
     out.push({prompt,tokens:ids,answer:result[0].generated_text.at(-1).content});
   }
   await pipe.dispose();return out;
 }''',{'system':m.SYSTEM,'model':m.MODEL,'revision':m.REVISION,'prompts':[p for p,_ in original_behavior]})
 record['browser']=browser;b.close()
record['elapsedSeconds']=round(time.monotonic()-start,3)
print('FULL_RUNTIME_DIAGNOSTIC',json.dumps(record,ensure_ascii=False),flush=True)
m.save(ROOT/'reports/chat-runtime-diagnostic.json',record)
