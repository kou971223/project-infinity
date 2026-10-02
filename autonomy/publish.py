"""Separate trusted write job: recheck evidence and publish data; never merge source.
GitHub credential is read here, never in model generation or sandbox execution.
"""
from __future__ import annotations
import base64,json,os,pathlib,re,sys,urllib.request,urllib.error
from contracts import *
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPO='kou971223/project-infinity'
API='https://api.github.com/repos/'+REPO
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):raise ValueError('API_REDIRECT_DENIED')
def call(endpoint,method='GET',body=None):
 token=os.environ.get('GH_TOKEN','')
 if not token:raise ValueError('PUBLISH_TOKEN_MISSING')
 req=urllib.request.Request(API+endpoint,data=json.dumps(body).encode() if body is not None else None,method=method,
     headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'})
 with urllib.request.build_opener(NoRedirect).open(req,timeout=20) as r:
  data=r.read(2000001)
  if len(data)>2000000:raise ValueError('API_SIZE')
  return json.loads(data or b'{}')
def blob_at(path,ref):
 try:
  x=call('/contents/'+path+'?ref='+ref);return json.loads(base64.b64decode(x['content']))
 except urllib.error.HTTPError as e:
  if e.code==404:return None
  raise

def main():
 raw=base64.b64decode(os.environ.get('AUTONOMY_RECORD_B64',''),validate=True)
 if not raw or len(raw)>80000:raise ValueError('RECORD_SIZE')
 record=verify_record(json.loads(raw))
 if record.get('status') not in ['completed','error']:raise ValueError('INCOMPLETE_EXECUTION')
 if record.get('baseCommit')!=os.environ.get('GITHUB_SHA') or record.get('runId')!=os.environ.get('GITHUB_RUN_ID'):raise ValueError('JOB_ORIGIN')
 previous=blob_at('autonomy/latest.json','research-records')
 if previous:verify_record(previous)
 if previous and previous['recordHash']==record['recordHash']:
  print(json.dumps({'status':'already_published'}));return
 if (previous or {}).get('recordHash')!=record.get('parentRecordHash'):raise ValueError('STALE_RESEARCH_PARENT')
 old=check_active((previous or {}).get('activeCheckpoint'))
 if record['status']=='completed' and record.get('learningEvidence'):
  active,decision=select_checkpoint(record['learningEvidence'],old)
  if decision!=record.get('learningDecision') or active!=record.get('activeCheckpoint'):raise ValueError('PUBLISH_GATE_MISMATCH')
 else:
  # Errors/deferrals cannot install or replace a checkpoint.
  if old!=record.get('activeCheckpoint'):raise ValueError('UNVALIDATED_CHECKPOINT')
 rid=record['runId']+'-'+record.get('attempt','1')
 if not re.fullmatch(r'[0-9]+-[0-9]+',rid):raise ValueError('RUN_ID')
 ref=call('/git/ref/heads/research-records');head=ref['object']['sha'];commit=call('/git/commits/'+head)
 # Recheck the content parent just before the single non-force ref update below.
 active=record.get('activeCheckpoint')
 status={'schema':VERSION,'at':record['at'],'event':record.get('event'),'runId':record['runId'],
         'runStatus':record['status'],'generationBefore':record.get('generationBefore',0),
         'generationAfter':active['generation'] if active else 0,'inheritedAcceptedCheckpoint':record.get('inheritedAcceptedCheckpoint',False),
         'decision':record.get('learningDecision',{}).get('decision','ERROR'),
         'sourceStatus':record.get('sourceCandidate',{}).get('status','not_run'),
         'literatureAccess':record.get('literature',{}).get('access','not_run'),
         'recordHash':record['recordHash'],'chatModelUpdated':False,'overallProjectAccepted':False}
 source=record.get('sourceCandidate',{})
 # A source candidate branch is isolated from main and from candidate/** CI triggers.
 if source.get('sandbox',{}).get('status')=='executed':
  patch=validate_patch(source['patch'],ROOT)
  base=record['baseCommit'];bc=call('/git/commits/'+base)
  tree=call('/git/trees','POST',{'base_tree':bc['tree']['sha'],'tree':[{'path':patch['path'],'mode':'100644','type':'blob','content':patch['content']}]})
  c=call('/git/commits','POST',{'tree':tree['sha'],'parents':[base],'message':'Unmerged machine source proposal '+rid+'; independent review required'})
  branch='research-source/'+rid
  call('/git/refs','POST',{'ref':'refs/heads/'+branch,'sha':c['sha']})
  status['sourceBranch']=branch
 paths={'autonomy/latest.json':record,'autonomy/runs/'+rid+'.json':record,'autonomy/status.json':status}
 tree=call('/git/trees','POST',{'base_tree':commit['tree']['sha'],'tree':[{'path':p,'mode':'100644','type':'blob','content':json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)} for p,v in paths.items()]})
 c=call('/git/commits','POST',{'tree':tree['sha'],'parents':[head],'message':'Preserve autonomy evidence '+rid+'; '+status['decision']})
 call('/git/refs/heads/research-records','PATCH',{'sha':c['sha'],'force':False})
 if os.environ.get('GITHUB_OUTPUT'):
  with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('record_commit='+c['sha']+'\n')
 print(json.dumps({'status':'published','recordCommit':c['sha'],**status},ensure_ascii=False))
if __name__=='__main__':main()
