/** Separate deterministic writer. It receives data, never a script or arbitrary path. */
import fs from 'node:fs';import {pathToFileURL} from 'node:url';
import {validateManifest,floatBytes,sha256,judge} from './manifest.js';
const REPO='kou971223/project-infinity',API='https://api.github.com/repos/'+REPO;
export async function publicationPlan(record){
 if(record?.schema!=='PINF-CHAT-PUBLICATION-1'||record.evaluation?.schema!=='PINF-CHAT-CANDIDATE-1')throw Error('RECORD_SCHEMA');
 const r=record.evaluation;
 if(!['completed','error'].includes(r.status)||typeof r.runId!=='string'||!/^\d+$/.test(r.runId)||!/^\d+$/.test(record.attempt))throw Error('ORIGIN');
 if(r.status==='error'||r.decision!=='ADOPT_CHAT_EXPERIMENTAL_NORM')return {install:false};
 const m=await validateManifest(record.release);const b=record.browser;
 if(!judge(r.evidence).pass||m.weightHash!==r.weightHash||m.sourceRecordHash!==r.sourceRecordHash)throw Error('EVIDENCE_BINDING');
 if(b?.status!=='passed'||b.mode!=='real-model'||b.weightHash!==m.weightHash||b.releaseHash!==m.releaseHash||b.verifiedChunks!==m.baseChunkHashes.length||b.rollbackVerified!==true||b.reloadVerified!==true||b.twoTurns!==true||b.noPaidPost!==true)throw Error('BROWSER_NOT_VERIFIED');
 return {install:true,manifest:m};
}
export async function publish(record,{token=process.env.GH_TOKEN,runId=process.env.GITHUB_RUN_ID,commit=process.env.GITHUB_SHA,fetcher=fetch}={}){
 if(!token)throw Error('NO_PUBLISH_CREDENTIAL');
 const r=record.evaluation;if(r.runId!==runId||r.baseCommit!==commit)throw Error('WRONG_WORKFLOW');
 const plan=await publicationPlan(record);
 async function call(url,method='GET',body){const res=await fetcher(API+url,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(res.status===404)return null;if(!res.ok)throw Error('GIT_HTTP_'+res.status);return res.json();}
 const ref=await call('/git/ref/heads/research-records');if(!ref)throw Error('NO_RECORD_BRANCH');const head=ref.object.sha;
 async function file(p){const x=await call('/contents/'+p+'?ref='+head);if(!x)return null;return JSON.parse(Buffer.from(x.content,'base64').toString('utf8'));}
 const previous=await file('chatlearn/active.json');if(previous)await validateManifest(previous);
 if(plan.install){
  const source=await file('autonomy/latest.json');
  if(source?.activeCheckpoint?.status!=='accepted_experimental'||await sha256(floatBytes(source.activeCheckpoint.values))!==plan.manifest.weightHash)throw Error('TRAINING_PARENT_CHANGED');
 }
 const rid=runId+'-'+record.attempt;
 const existing=await file('chatlearn/runs/'+rid+'.json');
 if(existing){if(JSON.stringify(existing)!==JSON.stringify(record))throw Error('RUN_RECORD_CONFLICT');return {status:'already_published',installed:plan.install};}
 const paths={['chatlearn/runs/'+rid+'.json']:record,'chatlearn/status.json':{at:new Date().toISOString(),runId,event:r.event,decision:r.decision,installed:plan.install,activeWeightHash:plan.install?plan.manifest.weightHash:previous?.weightHash||null,overallProjectAccepted:false}};
 if(plan.install){paths['chatlearn/active.json']=plan.manifest;paths['chatlearn/releases/'+plan.manifest.releaseHash+'.json']=plan.manifest;if(previous&&previous.releaseHash!==plan.manifest.releaseHash)paths['chatlearn/previous.json']=previous;}
 const base=await call('/git/commits/'+head);
 const tree=await call('/git/trees','POST',{base_tree:base.tree.sha,tree:Object.entries(paths).map(([path,value])=>({path,mode:'100644',type:'blob',content:JSON.stringify(value,null,2)}))});
 const c=await call('/git/commits','POST',{tree:tree.sha,parents:[head],message:'chat model bridge '+rid+': '+r.decision+'; bounded evidence only'});
 await call('/git/refs/heads/research-records','PATCH',{sha:c.sha,force:false});
 return {status:'published',installed:plan.install,commit:c.sha,weightHash:plan.manifest?.weightHash||null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const b=Buffer.from(process.env.CHAT_RECORD_B64||'','base64');if(!b.length||b.length>140000)throw Error('RECORD_SIZE');console.log(JSON.stringify(await publish(JSON.parse(b.toString('utf8')))));}
