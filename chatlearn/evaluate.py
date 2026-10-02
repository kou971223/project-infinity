"""Bridge an already-trained, accepted norm into the actual pinned ONNX chat model.
No optimizer, paid API, arbitrary code generation, private chat, or production write credential.
One candidate; fixed compatibility/benefit gate; failure leaves the existing chat untouched.
"""
from __future__ import annotations
import gc, hashlib, importlib.util, json, math, os, pathlib, random, re, shutil, signal, struct, sys, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROTOCOL='PINF-CHAT-NORM-2'
REPO='kou971223/project-infinity'
MODEL='onnx-community/Qwen2.5-0.5B-Instruct'
REVISION='cc5cc01a65cc3ff17bdb73a7de33d879f62599b0'
ASSET={'bytes':512096557,'sha256':'41834041ab1b29eff9fc592f1a29a1844133aea35832ea9fa91682be13016100','chunkSize':1048576,'offset':17876744,'length':3584,'normHash':'93a01a6db3419e85320a244bbf8ae81c43033b1d10c342bea3797ff2ce348390','parameter':'model.norm.weight'}
SYSTEM='You are Project Infinity, a small local assistant. Reply in Japanese. Be brief and honest about uncertainty. This chat runs locally. You cannot execute code, deploy apps or browse the web in this conversation. A separately tested partial model update may be loaded; do not claim general intelligence or recursive self-improvement has been demonstrated.'
ANCHORS=[
 '日本の首都は東京です。日本語では相手に伝わる簡潔な文章で答えます。',
 '一週間は七日です。一時間は六十分です。一分は六十秒です。',
 '雨の日には傘を使います。晴れた日には太陽が見えることがあります。',
 '正方形には四つの辺があります。三角形には三つの辺があります。',
 '不明な事実を推測で確定してはいけません。分からない場合は確認が必要です。',
 '会話の履歴と、モデルを学習するためのデータは同じものではありません。',
 'The river flows through the valley. Water is necessary for plants and animals.',
 'A computer program contains instructions. Testing can identify some programming errors.',
 'A triangle has three sides. A rectangle has four sides and four right angles.',
 'Two plus three equals five. Ten minus four equals six.',
 'Bonjour. Merci pour votre aide. Une explication claire est utile.',
 '你好。请简短地回答问题。不知道时应该说明不确定性。',
]
BEHAVIOR=[
 ('日本の首都を一語で答えてください。',['東京']),
 ('2+3の答えを数字だけで答えてください。',['5','５']),
 ('英語のappleを日本語に訳してください。',['りんご','リンゴ','林檎']),
 ('「確認しました」とだけ答えてください。',['確認しました']),
 ('一週間は何日ですか。短く答えてください。',['7','７','七']),
 ('水が凍ると何になりますか。',['氷']),
 ('10から4を引くといくつですか。',['6','６','六']),
 ('三角形の辺はいくつありますか。',['3','３','三']),
]
def h(b):return hashlib.sha256(b).hexdigest()
def save(p,x):
 p=pathlib.Path(p);p.parent.mkdir(parents=True,exist_ok=True);q=p.with_suffix('.tmp');q.write_text(json.dumps(x,ensure_ascii=False,allow_nan=False,indent=2));q.replace(p)
def get_json(url,limit=150000):
 req=urllib.request.Request(url,headers={'User-Agent':'ProjectInfinity-ChatBridge/0.7'})
 with urllib.request.urlopen(req,timeout=25) as r:
  b=r.read(limit+1)
  if len(b)>limit:raise ValueError('RECORD_SIZE')
  return json.loads(b)
def load_module(name,p):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def source_checkpoint():
 ref=get_json(f'https://api.github.com/repos/{REPO}/git/ref/heads/research-records')['object']['sha']
 if not re.fullmatch('[0-9a-f]{40}',ref):raise ValueError('REF')
 record=get_json(f'https://raw.githubusercontent.com/{REPO}/{ref}/autonomy/latest.json')
 c=load_module('source_contract',ROOT/'autonomy/contracts.py');c.verify_record(record)
 active=c.check_active(record.get('activeCheckpoint'))
 if not active:raise ValueError('NO_ACCEPTED_TRAINING_CHECKPOINT')
 return ref,record,active

def judge(e):
 for key,n in [('target',12),('anchors',12)]:
  for side in ['before','after']:
   v=e[key][side]
   if len(v)!=n or any(type(x) not in (float,int) or not math.isfinite(x) or x<0 for x in v):raise ValueError('MEASUREMENT')
 d=[a-b for a,b in zip(e['target']['before'],e['target']['after'])]
 a=[b-a for a,b in zip(e['anchors']['before'],e['anchors']['after'])]
 b=e['behavior']
 if len(b)!=8 or any(type(t[s]) is not bool for t in b for s in ['beforePass','afterPass']):raise ValueError('BEHAVIOR')
 n=sum(t['beforePass'] for t in b);reg=sum(t['beforePass'] and not t['afterPass'] for t in b)
 gain=sum(d)/12;worst=max(a);mean=sum(a)/12
 return {'pass':gain>=.01 and min(d)>0 and worst<=.05 and mean<=.01 and n>=4 and reg==0,'gain':gain,'worstAnchor':worst,'meanAnchor':mean,'baselinePassed':n,'regressions':reg}

def evaluate_model(file,tokenizer,targets):
 """Retained native reference for reproducing the pre-WASM diagnostic only."""
 import numpy as np, onnxruntime as ort
 so=ort.SessionOptions();so.intra_op_num_threads=2;so.inter_op_num_threads=1;so.enable_mem_pattern=False
 session=ort.InferenceSession(str(file),sess_options=so,providers=['CPUExecutionProvider'])
 inputs=session.get_inputs();outputs=[x.name for x in session.get_outputs()]
 def feed(ids,past=None,total=None):
  ids=np.array([ids],dtype=np.int64);n=ids.shape[1];total=total or n
  data={'input_ids':ids,'attention_mask':np.ones((1,total),dtype=np.int64),'position_ids':np.arange(total-n,total,dtype=np.int64)[None,:]}
  for t in inputs:
   if t.name.startswith('past_key_values.'):
    data[t.name]=(past or {}).get(t.name,np.zeros((1,2,0,64),dtype=np.float32))
  unknown={x.name for x in inputs}-set(data)
  if unknown:raise ValueError('UNSUPPORTED_MODEL_INPUTS '+str(sorted(unknown)))
  return {x.name:data[x.name] for x in inputs}
 def loss(text):
  ids=tokenizer(text,add_special_tokens=False,truncation=True,max_length=64)['input_ids']
  z=session.run(['logits'],feed(ids))[0][0,:-1,:].astype(np.float64)
  labels=np.array(ids[1:]);m=np.max(z,axis=-1)
  result=np.mean(np.log(np.exp(z-m[:,None]).sum(axis=-1))+m-z[np.arange(len(labels)),labels])
  if not math.isfinite(float(result)):raise ValueError('NONFINITE_LOSS')
  return float(result)
 def generate(prompt):
  ids=tokenizer.apply_chat_template([{'role':'system','content':SYSTEM},{'role':'user','content':prompt}],tokenize=True,add_generation_prompt=True)
  total=len(ids);past={};new=[]
  for _ in range(24):
   vals=dict(zip(outputs,session.run(None,feed(ids,past,total))))
   token=int(np.argmax(vals['logits'][0,-1]));new.append(token)
   if token in [tokenizer.eos_token_id,151645,151643]:break
   past={'past_key_values.'+k.removeprefix('present.'):v for k,v in vals.items() if k.startswith('present.')}
   if len(past)!=48:raise ValueError('KV_CACHE_CONTRACT')
   ids=[token];total+=1
  return tokenizer.decode(new,skip_special_tokens=True)
 result={'target':[loss(t) for t in targets],'anchors':[loss(t) for t in ANCHORS],'behavior':[generate(p) for p,_ in BEHAVIOR]}
 del session;gc.collect();return result

def main():
 start=time.monotonic();report={'schema':'PINF-CHAT-CANDIDATE-1','status':'running','protocol':PROTOCOL,'runId':os.environ.get('GITHUB_RUN_ID','local'),'baseCommit':os.environ.get('GITHUB_SHA','local'),'event':os.environ.get('GITHUB_EVENT_NAME','local'),'privateConversationUsed':False,'paidApiCalls':0,'overallProjectAccepted':False}
 def finish():report['elapsedSeconds']=round(time.monotonic()-start,3);save(ROOT/'reports/chat-candidate.json',report)
 if hasattr(signal,'SIGALRM'):
  signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('BRIDGE_TIME_BUDGET')));signal.alarm(720)
 try:
  ref,record,active=source_checkpoint();values=active['values'];raw=struct.pack('<896f',*values)
  report.update(sourceRef=ref,sourceRecordHash=record['recordHash'],weightHash=h(raw),generation=active['generation'])
  save(ROOT/'reports/chat-preregister.json',{'protocol':PROTOCOL,'candidateWeightHash':h(raw),'sourceRef':ref,'targetCases':12,'anchorCases':12,'behaviorCases':8,'minimumGain':.01,'worstAnchorIncrease':.05,'meanAnchorIncrease':.01,'behaviorRegressions':0,'minimumBaselineBehaviorPasses':4,'stopping':'one candidate; no post-result tuning','frozenBeforeEvaluation':True})
  from huggingface_hub import hf_hub_download
  original=pathlib.Path(hf_hub_download(MODEL,'onnx/model_quantized.onnx',revision=REVISION))
  hashes=[];full=hashlib.sha256()
  with original.open('rb') as f:
   while (b:=f.read(ASSET['chunkSize'])):hashes.append(h(b));full.update(b)
   f.seek(ASSET['offset']);old=f.read(ASSET['length'])
  if original.stat().st_size!=ASSET['bytes'] or full.hexdigest()!=ASSET['sha256'] or h(old)!=ASSET['normHash']:raise ValueError('BASE_MODEL_IDENTITY')
  if raw==old:raise ValueError('NO_WEIGHT_CHANGE')
  if max(abs(x-y) for x,y in zip(values,struct.unpack('<896f',old)))>.1:raise ValueError('NORM_CHANGE_BOUND')
  candidate=ROOT/'.runtime/chat-candidate.onnx';candidate.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original,candidate)
  with candidate.open('r+b') as f:f.seek(ASSET['offset']);f.write(raw)
  with candidate.open('rb') as f:
   full=hashlib.sha256()
   while (b:=f.read(1048576)):full.update(b)
   patched_hash=full.hexdigest();f.seek((ASSET['offset']//ASSET['chunkSize'])*ASSET['chunkSize']);patched_chunk=h(f.read(ASSET['chunkSize']))
  report['conversion']={'baseModelHash':ASSET['sha256'],'patchedModelHash':patched_hash,'modifiedBytes':ASSET['length'],'modifiedParameter':ASSET['parameter'],'allOtherBytesUnchanged':True}
  save(ROOT/'reports/chat-freeze.json',{'candidateHash':patched_hash,'weightHash':h(raw),'sourceRef':ref,'protocol':PROTOCOL})
  seed=int.from_bytes(os.urandom(16),'big');legacy=load_module('corpus_only',ROOT/'experiments/local_research.py');targets=legacy.corpus(seed,12)
  from wasm_evaluate import measure_wasm
  before,after=measure_wasm(original,candidate,targets,ANCHORS,BEHAVIOR,SYSTEM,MODEL,REVISION)
  evidence={'target':{'before':before['target'],'after':after['target']},'anchors':{'before':before['anchors'],'after':after['anchors']},
   'behavior':[{'id':i,'prompt':p,'before':a,'after':b,'beforePass':any(s in a for s in expected),'afterPass':any(s in b for s in expected)} for i,((p,expected),a,b) in enumerate(zip(BEHAVIOR,before['behavior'],after['behavior']))]}
  result=judge(evidence)
  report.update(status='completed',decision='ADOPT_CHAT_EXPERIMENTAL_NORM' if result['pass'] else 'REJECT_CHAT_NORM',result=result,evidence=evidence,evalSeedRevealedAfterDecision=str(seed),runtime={'backend':'transformers.js-3.8.1-WASM','browser':'Chromium Linux','threads':1,'generationRepetitionPenalty':1.1},measurementRevision='PINF-CHAT-WASM-EVAL-1',
   limitations=['Fixed operational QA checks, not a general intelligence benchmark','Target template shared with training; confirms quantized transfer, not OOD research gain','No Japanese chat quality improvement claimed','Candidate norm from previously accepted research training; not new training','Shared author and model; external independent validation absent','Browser E2E reload and rollback are separate required checks'])
  if result['pass']:
   report['release']={'schema':'PINF-CHAT-RELEASE-1','protocol':PROTOCOL,'status':'accepted_experimental','model':MODEL,'revision':REVISION,'device':'wasm','dtype':'q8','asset':ASSET,
    'generation':active['generation'],'sourceRef':ref,'sourceRecordHash':record['recordHash'],'trainingStatus':'accepted_experimental',
    'values':values,'weightHash':h(raw),'patchedModelHash':patched_hash,'baseChunkHashes':hashes,'patchedChunkHash':patched_chunk,
    'evidence':evidence,'actualOnnxEvaluation':True,'measurementRevision':'PINF-CHAT-WASM-EVAL-1','runId':report['runId'],'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'overallProjectAccepted':False}
  finish();print(json.dumps({'status':report['status'],'decision':report['decision'],'result':result}),flush=True);return 0
 except Exception as e:
  record_error=str(e)[:300];report.update(status='error',decision='NO_RELEASE',errorType=type(e).__name__,error=record_error);finish();print(json.dumps({'status':'error','error':record_error}),flush=True);return 1
 finally:
  if hasattr(signal,'SIGALRM'):signal.alarm(0)
if __name__=='__main__':sys.exit(main())
