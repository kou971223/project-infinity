"""Public knowledge and generated arithmetic programs; independent validation; data-only publication."""
import datetime,hashlib,json,os,pathlib,re,secrets,subprocess,sys,time,urllib.request,urllib.error,xml.etree.ElementTree as ET
from fractions import Fraction
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'continuity'));import evidence as sources
TASKS={'percentage':['amount','rate'],'discount':['amount','rate'],'mean':['a','b','c'],'rectangle':['width','height']}
DESCRIPTIONS={'percentage':'Return amount multiplied by rate percent.','discount':'Return the remaining amount after a discount of rate percent.','mean':'Return the arithmetic mean of a, b, c.','rectangle':'Return the area of a rectangle with width and height.'}
def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read_active(lane):
 try:
  with urllib.request.urlopen('https://raw.githubusercontent.com/kou971223/project-infinity/research-records/'+lane+'/active.json',timeout=15) as r:data=r.read(160001)
  if len(data)>160000:raise ValueError('RECORD_SIZE')
  x=json.loads(data)
  if digest({k:v for k,v in x.items() if k!='artifactHash'})!=x['artifactHash']:raise ValueError('PARENT_HASH')
  return x
 except urllib.error.HTTPError as e:
  if e.code==404:return None
  raise
def plain(text):
 p=sources.Text();p.feed(text);return ' '.join(' '.join(p.parts).split())
def collect(fetcher=sources.retrieve):
 cards=[];failures=[]
 for sid,url,kind in sources.SOURCES:
  try:
   raw=fetcher(url);text=raw.decode('utf-8')
   if kind=='primary_abstract_feed':
    root=ET.fromstring(text)
    for item in root.findall('.//item')[:6]:
     link=item.findtext('link','').replace('http://','https://')
     if not re.fullmatch(r'https://arxiv.org/abs/\d{4}\.\d{4,5}(?:v\d+)?',link):continue
     excerpt=plain(item.findtext('description',''))[:600]
     if len(excerpt)<30:continue
     cards.append(dict(url=link,title=plain(item.findtext('title',''))[:300],excerpt=excerpt,excerptHash=digest(excerpt),kind='abstract_excerpt',checkedAt=now(),source=url,sourceHash=sources.sha(raw)))
   else:
    body=plain(text);marker='Due to the experimental nature' if 'WEBGPU' in sid else 'The list of available quantizations';pos=body.find(marker)
    if pos<0:raise ValueError('SOURCE_SECTION_CHANGED')
    excerpt=body[pos:pos+600]
    cards.append(dict(url=url,title='Transformers.js 3.8.1 '+('WebGPU' if 'WEBGPU' in sid else 'quantization dtypes'),excerpt=excerpt,excerptHash=digest(excerpt),kind='official_document_excerpt',checkedAt=now(),source=url,sourceHash=sources.sha(raw)))
  except Exception as e:failures.append(dict(url=url,error=type(e).__name__))
 return cards,failures
def program_nodes(p):
 if set(p)!={'task','expression','hypothesis'} or p['task'] not in TASKS or not isinstance(p['hypothesis'],str) or len(p['hypothesis'])>400:raise ValueError('PROGRAM_SCHEMA')
 count=0
 def visit(x,depth):
  nonlocal count
  count+=1
  if count>48 or depth>8 or not isinstance(x,list):raise ValueError('PROGRAM_LIMIT')
  if len(x)==2 and x[0]=='var' and x[1] in TASKS[p['task']]:return
  if len(x)==2 and x[0]=='const' and isinstance(x[1],str) and re.fullmatch(r'-?\d{1,6}',x[1]):return
  if len(x)!=3 or x[0] not in ['add','sub','mul','div']:raise ValueError('PROGRAM_OPCODE')
  visit(x[1],depth+1);visit(x[2],depth+1)
 visit(p['expression'],0);return count
def oracle(task,a):
 a={k:Fraction(v) for k,v in a.items()}
 v=a['amount']*a['rate']/100 if task=='percentage' else a['amount']*(100-a['rate'])/100 if task=='discount' else sum(a.values())/3 if task=='mean' else a['width']*a['height']
 return str(v)
def cases(task,seed):
 rng=__import__('random').Random(seed);rows=[]
 for i in range(64):
  a={k:str(Fraction(rng.randint(-999999,999999),100)) for k in TASKS[task]}
  # Inputs are decimal strings, expected answers are canonical exact fractions.
  a={k:format(float(Fraction(v)),'.2f') for k,v in a.items()}
  if i==0:a={k:'0' for k in a}
  if i==1:a={k:'1' for k in a}
  if i==2:a={k:'-1' for k in a}
  rows.append(dict(args=a,expected=oracle(task,a)))
 return rows
def generate_program(task):
 prompt='Generate one bounded arithmetic program. Reply JSON with exactly task, expression, hypothesis. No Markdown. Task: '+task+'. '+DESCRIPTIONS[task]+' Variables: '+', '.join(TASKS[task])+'. Tree grammar: ["var",name], ["const",integerString], or [op,left,right] where op is add/sub/mul/div. At most 48 nodes and depth 8. No code, files, tools, authority or validator edits. hypothesis must state the intended behavior, not claim passing.'
 script="import {infer} from './src/keyless-inference.js';const r=await infer([{role:'user',content:"+json.dumps(prompt)+"}],{research:true,system:'Generate data-only arithmetic trees. No execution or adoption authority.'});process.stdout.write(r.reply);"
 r=subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,capture_output=True,text=True,timeout=65)
 if r.returncode:raise ValueError(next((x for x in ['KEYLESS_UNAVAILABLE','UPSTREAM_TIMEOUT','UPSTREAM_BUSY','INCOMPLETE_UPSTREAM'] if x in r.stderr),'GENERATION_FAILED'))
 raw=r.stdout.strip()
 if raw.startswith('```'):raw=raw.split('\n',1)[1].rsplit('```',1)[0].strip()
 p=json.loads(raw);program_nodes(p)
 if p['task']!=task:raise ValueError('TASK_CHANGED')
 return p
def propose():
 knowledge=read_active('knowledge');programs=read_active('programs');cards,failures=collect()
 old=programs.get('programs',[]) if programs else [];task=next((t for t in TASKS if t not in [e['program']['task'] for e in old]),None)
 if task is None:task=list(TASKS)[int(os.environ.get('GITHUB_RUN_NUMBER','0'))%len(TASKS)]
 r=dict(schema='PINF-RESEARCH-2',at=now(),baseCommit=os.environ.get('GITHUB_SHA','local'),runId=os.environ.get('GITHUB_RUN_ID','local'),parents={k:(v or {}).get('artifactHash') for k,v in [('knowledge',knowledge),('programs',programs)]},cards=cards,sourceFailures=failures,task=task,privateDataUsed=False)
 r['generationAttempts']=[]
 for attempt in range(2):
  try:r['programCandidate']=generate_program(task);r['generationAttempts'].append(dict(ok=True));break
  except Exception as e:
   reason=str(e)[:200];r['generationAttempts'].append(dict(ok=False,reason=reason))
   if attempt==0 and reason in ['KEYLESS_UNAVAILABLE','UPSTREAM_TIMEOUT','UPSTREAM_BUSY','INCOMPLETE_UPSTREAM']:time.sleep(35)
   else:break
 if 'programCandidate' not in r:
  r['programFailure']=r['generationAttempts'][-1]['reason']
  from synthesize import synthesize
  training_seed=secrets.randbits(48);training=cases(task,training_seed)[3:7]
  candidate,search=synthesize(task,TASKS[task],training,max_states=50000)
  r['synthesis']=dict(trainingSeed=training_seed,trainingExamples=training,**search)
  if candidate:r['programCandidate']=candidate;r['candidateOrigin']='local_enumerative_synthesis'
 else:r['candidateOrigin']='anonymous_external_model'
 r['frozenHash']=digest({k:r[k] for k in ['cards','task','programCandidate'] if k in r});return r
def validate(r):
 if r['schema']!='PINF-RESEARCH-2' or r['baseCommit']!=os.environ.get('GITHUB_SHA','local') or r['frozenHash']!=digest({k:r[k] for k in ['cards','task','programCandidate'] if k in r}):raise ValueError('FROZEN_ORIGIN')
 fresh,failures=collect();by_url={c['url']:c for c in fresh};verified=[];rejected=[]
 for c in r['cards']:
  check=by_url.get(c['url'])
  if check and all(check[k]==c[k] for k in ['title','excerpt','excerptHash','kind','source']):verified.append(c)
  else:rejected.append(c['url'])
 r['knowledgeEvidence']=dict(protocol='PINF-SOURCE-MATCH-1',verifiedCards=verified,rejected=rejected,failures=failures)
 if 'programCandidate' in r:
  p=r['programCandidate'];program_nodes(p);seed=secrets.randbits(48);cs=cases(p['task'],seed)
  out=subprocess.run(['node','research/program-runner.js'],input=json.dumps(dict(program=p,cases=cs)),text=True,capture_output=True,cwd=ROOT,timeout=10)
  replies=json.loads(out.stdout) if out.returncode==0 else []
  e=dict(protocol='PINF-PROGRAM-TEST-1',candidateHash=digest(p),seed=seed,cases=[dict(c,**v) for c,v in zip(cs,replies)],nodes=program_nodes(p))
  e['passed']=len(e['cases'])==64 and all(c.get('reply')==c['expected'] for c in e['cases']);r['programEvidence']=e
 r['validationCompleted']=True;return r
def checked(r):
 if r.get('schema')!='PINF-RESEARCH-2' or r.get('validationCompleted') is not True or r['baseCommit']!=os.environ.get('GITHUB_SHA','local') or r['runId']!=os.environ.get('GITHUB_RUN_ID','local'):raise ValueError('VALIDATOR_ORIGIN')
 if r['frozenHash']!=digest({k:r[k] for k in ['cards','task','programCandidate'] if k in r}):raise ValueError('FROZEN_HASH')
 for c in r['knowledgeEvidence']['verifiedCards']:
  if c not in r['cards'] or c['excerptHash']!=digest(c['excerpt']) or c['source'] not in sources.ALLOWED or len(c['excerpt'])>600:raise ValueError('SOURCE_EVIDENCE')
 e=r.get('programEvidence');p=r.get('programCandidate')
 if e and e.get('passed'):
  program_nodes(p)
  if e['protocol']!='PINF-PROGRAM-TEST-1' or e['candidateHash']!=digest(p) or e['nodes']!=program_nodes(p) or len(e['cases'])!=64:raise ValueError('PROGRAM_EVIDENCE')
  for expected,actual in zip(cases(p['task'],e['seed']),e['cases']):
   if actual['args']!=expected['args'] or actual['expected']!=expected['expected'] or actual.get('reply')!=expected['expected']:raise ValueError('PROGRAM_ORACLE')
 return r
def publication(r,previous):
 checked(r);paths={};decisions={}
 for lane in ['knowledge','programs']:
  old=previous[lane]
  if (old or {}).get('artifactHash')!=r['parents'][lane]:raise ValueError('STALE_PARENT')
  content=None
  if lane=='knowledge':
   fresh=r['knowledgeEvidence']['verifiedCards'];cards={c['url']:c for c in (old or {}).get('cards',[])};changed=any(c['url'] not in cards or cards[c['url']]['excerptHash']!=c['excerptHash'] for c in fresh)
   for c in fresh:cards[c['url']]=c
   if changed:
    values=sorted(cards.values(),key=lambda c:c['checkedAt'],reverse=True)[:24]
    content=dict(schema='PINF-KNOWLEDGE-1',cards=values,evidence=dict(protocol='PINF-SOURCE-MATCH-1',passed=True,verified=len(values)))
   decisions[lane]='ADOPT' if content else 'NO_CHANGE' if fresh else 'DEFER_SOURCE_UNAVAILABLE'
  else:
   p=r.get('programCandidate');e=r.get('programEvidence');entries=(old or {}).get('programs',[]);prior=next((v for v in entries if p and v['program']['task']==p['task']),None)
   if p and e and e['passed'] and (not prior or program_nodes(p)<program_nodes(prior['program'])):
    content=dict(schema='PINF-PROGRAMS-1',programs=[v for v in entries if v is not prior]+[dict(program=p,evidence=e)])
   decisions[lane]='ADOPT' if content else 'NO_GAIN' if e and e['passed'] else 'REJECT_OR_DEFER'
  if content:
   content.update(generation=(old or {}).get('generation',0)+1,parentHash=(old or {}).get('artifactHash'),at=r['at'],runId=r['runId']);content['artifactHash']=digest(content);paths[lane+'/active.json']=content
  generation=content['generation'] if content else (old or {}).get('generation',0)
  paths[lane+'/status.json']=dict(schema='PINF-'+lane.upper()+'-1',at=r['at'],runId=r['runId'],decision=decisions[lane],applied=bool(content),generationAfter=generation,summary='公開資料の原文一致・出典検証。主張の独立再現ではありません。' if lane=='knowledge' else '生成した限定演算プログラムを64例の独立オラクルで検証。基盤モデルの学習ではありません。')
 r['decisions']=decisions;return paths
def publish(r):
 if os.environ.get('GITHUB_REF')!='refs/heads/main':raise ValueError('PUBLICATION_MAIN_ONLY')
 sys.path.insert(0,str(ROOT/'autonomy'));from publish import call,blob_at
 for attempt in range(3):
  head=call('/git/ref/heads/research-records')['object']['sha'];tree=call('/git/commits/'+head)['tree']['sha'];previous={lane:blob_at(lane+'/active.json',head) for lane in ['knowledge','programs']};paths=publication(r,previous)
  rid=r['runId']+'-'+os.environ.get('GITHUB_RUN_ATTEMPT','1')
  if not re.fullmatch(r'\d+-\d+',rid):raise ValueError('RUN_ID')
  r['recordHash']=digest({k:v for k,v in r.items() if k!='recordHash'});paths.update({'research-v2/latest.json':r,'research-v2/runs/'+rid+'.json':r})
  t=call('/git/trees','POST',dict(base_tree=tree,tree=[dict(path=p,mode='100644',type='blob',content=json.dumps(x,ensure_ascii=False,indent=2)) for p,x in paths.items()]));c=call('/git/commits','POST',dict(tree=t['sha'],parents=[head],message='research v2: '+json.dumps(r['decisions'])+' '+rid))
  try:call('/git/refs/heads/research-records','PATCH',dict(sha=c['sha'],force=False));break
  except Exception:
   if attempt==2:raise
 print(json.dumps(dict(decisions=r['decisions'],archiveCommit=c['sha'])))
if __name__=='__main__':
 mode=sys.argv[1];file=ROOT/'reports/research-v2.json'
 if mode=='propose':r=propose()
 elif mode=='validate':r=validate(json.loads(file.read_text()))
 elif mode=='publish':publish(json.loads(file.read_text()));sys.exit()
 else:raise ValueError('MODE')
 file.parent.mkdir(exist_ok=True);file.write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({k:r.get(k) for k in ['task','programFailure','validationCompleted']}))
 if mode=='validate':print('RESEARCH_V2_EVIDENCE='+json.dumps(r,ensure_ascii=False))
