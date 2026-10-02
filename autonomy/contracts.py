"""Trusted epoch contract. Candidates are data and cannot modify this module."""
from __future__ import annotations
import hashlib, json, math, pathlib
VERSION = 'PINF-AUTONOMY-1'
MODEL = 'Qwen/Qwen2.5-0.5B-Instruct'
REVISION = '7ae557604adf67be50417f59c2c2f167def9a775'
PARAMETER = 'model.norm.weight'
POLICY = {'id':VERSION, 'steps':32, 'learningRate':0.0005, 'seeds':[104729,130363],
          'confirmDocuments':12, 'anchorDocuments':6, 'minLossReduction':0.01,
          'maxAnchorLossIncrease':0.05, 'maxSequenceTokens':64,
          'maxCycleSeconds':600, 'maxSourceFiles':1, 'maxPatchBytes':16000,
          'promotionScope':'experimental CPU researcher norm only; browser model unchanged'}
# Application source can be proposed; trust plane, tests, credentials and release controls cannot.
EDITABLE = {'web/free-chat.js', 'web/chat-worker.js', 'web/index.html', 'src/ui.html'}
def digest(value):
    b = value if isinstance(value,bytes) else json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    return hashlib.sha256(b).hexdigest()
def save(file, value):
    p=pathlib.Path(file);p.parent.mkdir(parents=True,exist_ok=True)
    q=p.with_suffix(p.suffix+'.tmp');q.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False,indent=2),encoding='utf-8');q.replace(p)
def seal(record):
    b=dict(record);b.pop('recordHash',None);b['recordHash']=digest(b);return b
def verify_record(record):
    if not isinstance(record,dict):raise ValueError('RECORD_TYPE')
    b=dict(record);h=b.pop('recordHash',None)
    if not isinstance(h,str) or digest(b)!=h:raise ValueError('RECORD_HASH')
    if record.get('schema')!=VERSION:raise ValueError('RECORD_VERSION')
    return record

def check_active(active):
    if active is None:return None
    if not isinstance(active,dict) or active.get('model')!=MODEL or active.get('revision')!=REVISION or active.get('parameter')!=PARAMETER:raise ValueError('CHECKPOINT_IDENTITY')
    values=active.get('values')
    if not isinstance(values,list) or len(values)!=896 or any(type(x) not in (int,float) or not math.isfinite(x) or abs(x)>100 for x in values):raise ValueError('CHECKPOINT_VALUES')
    if digest(values)!=active.get('weightHash') or active.get('status')!='accepted_experimental':raise ValueError('CHECKPOINT_HASH_OR_STATUS')
    if not isinstance(active.get('generation'),int) or active['generation']<1:raise ValueError('GENERATION')
    if active.get('protocolHash')!=digest(POLICY):raise ValueError('CHECKPOINT_EPOCH')
    return active

def validate_patch(patch,root):
    if not isinstance(patch,dict) or set(patch)!={'path','baseHash','content','hypothesis'}:raise ValueError('PATCH_SCHEMA')
    if patch['path'] not in EDITABLE:raise ValueError('PROTECTED_PATH')
    p=pathlib.Path(root)/patch['path']
    if not p.is_file() or p.is_symlink():raise ValueError('PATCH_TARGET')
    if digest(p.read_bytes())!=patch['baseHash']:raise ValueError('STALE_BASE')
    text=patch['content']
    if not isinstance(text,str) or not text.strip() or len(text.encode())>POLICY['maxPatchBytes'] or '\x00' in text:raise ValueError('PATCH_SIZE')
    if not isinstance(patch['hypothesis'],str) or not 10<=len(patch['hypothesis'])<=1200:raise ValueError('PATCH_HYPOTHESIS')
    if text==p.read_text(encoding='utf-8'):raise ValueError('NO_SOURCE_CHANGE')
    return dict(patch)

def judge_trial(trial):
    """Deterministic integration gate, not a general ability measure."""
    for name,n in [('before',12),('after',12),('anchorBefore',6),('anchorAfter',6)]:
        x=trial.get(name)
        if not isinstance(x,list) or len(x)!=n or any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in x):raise ValueError('INVALID_MEASUREMENTS')
    delta=[a-b for a,b in zip(trial['before'],trial['after'])]
    gain=sum(delta)/len(delta)
    # All heldout documents must improve. Synthetic templates are correlated, not independent studies.
    anchor=max(b-a for a,b in zip(trial['anchorBefore'],trial['anchorAfter']))
    return {'pass':gain>=0.01 and min(delta)>0 and anchor<=0.05,'gain':gain,'worstAnchorIncrease':anchor}

def select_checkpoint(report,previous):
    """Recomputes acceptance; never accepts a generated PASS string."""
    if report.get('protocolHash')!=digest(POLICY):raise ValueError('EPOCH_MISMATCH')
    parentHash=previous['weightHash'] if previous else report.get('basePretrainedHash')
    if report.get('parentHash')!=parentHash:raise ValueError('PARENT_MISMATCH')
    trials=report.get('trials')
    if not isinstance(trials,list) or len(trials)!=2:raise ValueError('REPLICATION_MISSING')
    decisions=[judge_trial(x) for x in trials]
    if not all(x['pass'] for x in decisions):return previous,{'decision':'REJECT_WEIGHT_UPDATE','trials':decisions}
    values=report.get('candidateValues')
    child={'model':MODEL,'revision':REVISION,'parameter':PARAMETER,'values':values,
           'weightHash':digest(values),'parentHash':parentHash,'protocolHash':digest(POLICY),
           'generation':(previous['generation'] if previous else 0)+1,'status':'accepted_experimental'}
    check_active(child)
    if child['weightHash']==parentHash:raise ValueError('NO_WEIGHT_CHANGE')
    # Trial 0 is always the release candidate, never the best of the two repetitions.
    if trials[0].get('candidateHash')!=child['weightHash']:raise ValueError('POST_EVALUATION_MUTATION')
    if any(t.get('parentHash')!=parentHash or t.get('seed')!=POLICY['seeds'][i] for i,t in enumerate(trials)):raise ValueError('TRIAL_PROVENANCE')
    return child,{'decision':'ADOPT_EXPERIMENTAL_RESEARCHER_NORM','trials':decisions}

def expand_edit(edit, root):
    if not isinstance(edit,dict) or set(edit)!={'path','baseHash','find','replace','hypothesis'}:raise ValueError('EDIT_SCHEMA')
    if edit['path'] not in EDITABLE:raise ValueError('PROTECTED_PATH')
    p=pathlib.Path(root)/edit['path']
    if not p.is_file() or p.is_symlink():raise ValueError('EDIT_TARGET')
    old=p.read_text(encoding='utf-8')
    if not isinstance(edit['find'],str) or not edit['find'] or old.count(edit['find'])!=1:raise ValueError('EDIT_MUST_MATCH_ONCE')
    if not isinstance(edit['replace'],str) or len(edit['replace'])>3000:raise ValueError('EDIT_REPLACEMENT')
    return validate_patch({'path':edit['path'],'baseHash':edit['baseHash'],'content':old.replace(edit['find'],edit['replace'],1),'hypothesis':edit['hypothesis']},root)
