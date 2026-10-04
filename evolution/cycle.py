"""Frozen finite proposals; independent Python arithmetic oracle; no generated executable code."""
import base64,datetime,decimal,hashlib,json,os,pathlib,secrets,subprocess,sys,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROTOCOL='PINF-CHAT-EVOLUTION-1'
CAPS=['exact-integer-v1','metric-length-v1']
def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def base():return dict(schema=PROTOCOL,generation=0,capabilities=[],parentHash=None)
def read_active():
 try:
  with urllib.request.urlopen('https://raw.githubusercontent.com/kou971223/project-infinity/research-records/dialogue/active.json',timeout=15) as r:
   raw=r.read(50001)
  if len(raw)>50000:raise ValueError('RECORD_SIZE')
  x=json.loads(raw);body={k:v for k,v in x.items() if k!='artifactHash'}
  if digest(body)!=x['artifactHash']:raise ValueError('HASH')
  return x
 except urllib.error.HTTPError as e:
  if e.code==404:return None
  raise

def check_policy(p):
 if set(p)!=set(base()) or p['schema']!=PROTOCOL or type(p['generation'])!=int or p['generation']<0 or p['generation']>100000 or not isinstance(p['capabilities'],list) or len(set(p['capabilities']))!=len(p['capabilities']) or any(c not in CAPS for c in p['capabilities']):raise ValueError('POLICY')
 return p

def judge(e):
 if e.get('protocol')!=PROTOCOL or len(e.get('pairs',[]))!=8:return False
 pairs=e['pairs']
 if any(not p['baseline'].get('ok') or not p['candidate'].get('ok') for p in pairs):return False
 old=sum(p['baseline']['reply'].strip()==p['expected'] for p in pairs);new=sum(p['candidate']['reply'].strip()==p['expected'] for p in pairs)
 faster=sum(p['candidate']['ms']*2+20<p['baseline']['ms'] for p in pairs)
 return new==len(pairs) and new>=old and (new>old or faster>=4)

def propose():
 previous=read_active();old=check_policy(previous['active'] if previous else base())
 # Finite scope is explicit. Reassess the deployed generation even after both modules are present.
 new=next((c for c in CAPS if c not in old['capabilities']),None)
 candidate=dict(old) if not new else dict(schema=PROTOCOL,generation=old['generation']+1,capabilities=old['capabilities']+[new],parentHash=digest(old))
 return dict(schema=PROTOCOL,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),baseCommit=os.environ.get('GITHUB_SHA','local'),runId=os.environ.get('GITHUB_RUN_ID','local'),parentArtifactHash=previous.get('artifactHash') if previous else None,baseline=old,candidate=candidate,candidateHash=digest(candidate),hypothesis='A fixed exact-answer capability improves correctness or halves latency without changing general-chat routing.',decision='FROZEN' if new else 'MONITOR',newCapability=new,history=previous.get('history',[]) if previous else [])

def cases(cap,seed):
 rng=__import__('random').Random(seed);out=[]
 for i in range(8):
  if cap=='exact-integer-v1':
   a=rng.randint(10000001,99999999);b=rng.randint(10001,99999);op=['+','×','−','÷'][i%4]
   if op=='÷':a=b*rng.randint(11,97)
   answer={'+':lambda:a+b,'×':lambda:a*b,'−':lambda:a-b,'÷':lambda:a//b}[op]()
   out.append((f'{a} {op} {b}',str(answer)))
  else:
   a=decimal.Decimal(rng.randint(-900000,900000))/1000;src,dst=rng.choice([('m','mm'),('mm','m'),('cm','mm'),('mm','cm')]);scale={'mm':decimal.Decimal(1),'cm':decimal.Decimal(10),'m':decimal.Decimal(1000)}
   n=a*scale[src]/scale[dst];value=format(n,'f');value=value.rstrip('0').rstrip('.') if '.' in value else value
   out.append((f'{a} {src} to {dst}',value+' '+dst))
 return out

def run(prompt,policy):
 p=subprocess.run(['node','evolution/runner.js'],cwd=ROOT,input=json.dumps(dict(prompt=prompt,policy=policy)),text=True,capture_output=True,timeout=55)
 if p.returncode:raise ValueError('RUNNER_ERROR')
 return json.loads(p.stdout)

def validate(r):
 if r['schema']!=PROTOCOL or r['baseCommit']!=os.environ.get('GITHUB_SHA','local') or digest(check_policy(r['candidate']))!=r['candidateHash']:raise ValueError('ORIGIN')
 old=check_policy(r['baseline']);candidate=r['candidate'];new=r['newCapability']
 if new and (candidate['capabilities']!=old['capabilities']+[new] or new not in CAPS or new in old['capabilities'] or candidate['generation']!=old['generation']+1 or candidate['parentHash']!=digest(old)):raise ValueError('CANDIDATE_AUTHORITY')
 seed=secrets.randbits(48);tested=new or CAPS[int(os.environ.get('GITHUB_RUN_NUMBER','0'))%len(CAPS)];r['testedCapability']=tested;pairs=[];last=0;deadline=time.monotonic()+600
 for q,expected in cases(tested,seed):
  outputs={}
  for label,policy in [('baseline',old),('candidate',candidate)]:
   # An inactive capability uses the real unchanged anonymous inference path.
   needs_remote=tested not in policy['capabilities']
   if needs_remote:
    time.sleep(max(0,30-(time.monotonic()-last)));last=time.monotonic()
   outputs[label]=run(q,policy)
   if needs_remote and not outputs[label].get('ok') and time.monotonic()+90<deadline:
    first=outputs[label];time.sleep(35);last=time.monotonic();outputs[label]=run(q,policy);outputs[label]['attempts']=[first,{k:v for k,v in outputs[label].items()}];outputs[label]['ms']+=first['ms']+35000
  pairs.append(dict(prompt=q,expected=expected,**outputs))
  if any(not v.get('ok') for v in outputs.values()) or time.monotonic()>deadline:break
 e=dict(protocol=PROTOCOL,seed=seed,candidateHash=digest(candidate),pairs=pairs)
 e['passed']=judge(e);e['baselineCorrect']=sum(p['baseline'].get('reply','').strip()==p['expected'] for p in pairs);e['candidateCorrect']=sum(p['candidate'].get('reply','').strip()==p['expected'] for p in pairs)
 r['evidence']=e;r['decision']=('ADOPT' if e['passed'] else 'REJECT_OR_DEFER') if new else ('MONITOR_PASS' if e['passed'] else 'MONITOR_FAILED')
 # Monitoring identical tools has no speed gain; correctness is the monitoring condition.
 if not new:r['decision']='MONITOR_PASS' if len(pairs)==8 and e['candidateCorrect']==8 else 'MONITOR_FAILED'
 return r

def publish(r):
 sys.path.insert(0,str(ROOT/'autonomy'));from publish import call,blob_at
 if r['baseCommit']!=os.environ.get('GITHUB_SHA') or r['runId']!=os.environ.get('GITHUB_RUN_ID'):raise ValueError('ORIGIN')
 if r['decision']=='ADOPT' and not judge(r['evidence']):raise ValueError('INDEPENDENT_GATE')
 for attempt in range(3):
  head=call('/git/ref/heads/research-records')['object']['sha'];tree=call('/git/commits/'+head)['tree']['sha'];previous=blob_at('dialogue/active.json',head)
  if (previous or {}).get('artifactHash')!=r['parentArtifactHash']:raise ValueError('STALE_PARENT')
  if r['baseline']!=(previous or {}).get('active',base()):raise ValueError('BASELINE_MISMATCH')
  paths={};active=previous
  if r['decision']=='ADOPT':
   if digest(check_policy(r['candidate']))!=r['evidence']['candidateHash']:raise ValueError('CANDIDATE_HASH')
   active=dict(schema=PROTOCOL,active=r['candidate'],history=(r['history']+[r['baseline']])[-10:],decision='ADOPT',evidence=r['evidence'],at=r['at'],runId=r['runId'])
   active['artifactHash']=digest(active);paths['dialogue/active.json']=active
  r['applied']=r['decision']=='ADOPT';r['recordHash']=digest({k:v for k,v in r.items() if k!='recordHash'})
  rid=r['runId']+'-'+os.environ.get('GITHUB_RUN_ATTEMPT','1')
  if not __import__('re').fullmatch(r'\d+-\d+',rid):raise ValueError('RUN_ID')
  summary=dict(schema=PROTOCOL,at=r['at'],runId=r['runId'],decision=r['decision'],applied=r['applied'],generationAfter=(active or {}).get('active',base())['generation'],summary='実会話に継承する回答補助の研究。基盤モデルの重み学習ではありません。')
  paths.update({'dialogue/runs/'+rid+'.json':r,'dialogue/latest.json':r,'dialogue/status.json':summary})
  t=call('/git/trees','POST',{'base_tree':tree,'tree':[dict(path=p,mode='100644',type='blob',content=json.dumps(v,ensure_ascii=False,indent=2)) for p,v in paths.items()]})
  c=call('/git/commits','POST',dict(tree=t['sha'],parents=[head],message='dialogue: '+r['decision']+' '+rid))
  try:call('/git/refs/heads/research-records','PATCH',dict(sha=c['sha'],force=False));break
  except Exception:
   if attempt==2:raise
 print(json.dumps(summary));return

if __name__=='__main__':
 f=ROOT/'reports/dialogue.json';mode=sys.argv[1]
 if mode=='propose':r=propose()
 elif mode=='validate':r=validate(json.loads(f.read_text()))
 elif mode=='publish':publish(json.loads(f.read_text()));sys.exit()
 else:raise ValueError('MODE')
 f.parent.mkdir(exist_ok=True);f.write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({k:r.get(k) for k in ['decision','newCapability','candidateHash']}))
 if mode=='validate':print('DIALOGUE_EVIDENCE='+json.dumps(r,ensure_ascii=False))
