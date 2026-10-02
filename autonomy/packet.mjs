/** Canonical, data-only publication packet. No candidate imports or evaluation. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const ALLOWED=Object.freeze(['src/app-server.js','src/server.js','web/free-chat.js','web/chat-worker.js','web/index.html']);
export function canonical(x){
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(x!==null&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  if(typeof x==='number'&&!Number.isFinite(x)||x===undefined)throw Error('NON_JSON');
  return JSON.stringify(x);
}
export const digest=x=>createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
export function checkPacket(x){
  if(!x||x.schema!=='PINF-AUTONOMY-1'||!Number.isSafeInteger(x.generation)||x.generation<1)throw Error('RECORD_SCHEMA');
  const {recordHash,...body}=x;
  if(digest(body)!==recordHash)throw Error('RECORD_HASH');
  if(x.promoted!==false||x.overallProjectAccepted!==false||x.cost?.paidInferenceCalls!==0||x.cost?.newPaidServices!==0)throw Error('AUTHORITY_DENIED');
  if(!/^[a-f0-9]{40}$/.test(x.sourceCommit)||!/^[0-9]+$/.test(x.runId))throw Error('RUN_IDENTITY');
  if(!Array.isArray(x.history)||x.history.length>24)throw Error('HISTORY_SIZE');
  if(Buffer.byteLength(canonical(x))>160000)throw Error('PACKET_SIZE');
  if(x.candidate)checkCandidate(x.candidate,x.sourceCommit);
  return x;
}
export function checkCandidate(c,sha){
  const {candidateHash,...body}=c;
  if(digest(body)!==candidateHash||c.baseSha!==sha||c.schema!=='PINF-SOURCE-CANDIDATE-1')throw Error('CANDIDATE_IDENTITY');
  if(c.authority!=='candidate-branch-only'||c.protocol?.id!=='PINF-SOURCE-REVIEW-1'||c.protocol.promotion!=='review_branch_only')throw Error('CANDIDATE_AUTHORITY');
  if(!Array.isArray(c.changes)||!c.changes.length||c.changes.length>2)throw Error('CANDIDATE_COUNT');
  const seen=new Set();
  for(const f of c.changes){
    if(!ALLOWED.includes(f.path)||seen.has(f.path))throw Error('PATH_DENIED');seen.add(f.path);
    if(typeof f.content!=='string'||Buffer.byteLength(f.content)>32000||digest(f.content)!==f.afterHash||typeof f.before!=='string'||!f.before||typeof f.after!=='string'||f.before===f.after)throw Error('CONTENT_DENIED');
  }
  return c;
}
export function summary(r){
  checkPacket(r);
  return {available:true,version:r.version,generation:r.generation,at:r.at,event:r.event,
    runId:r.runId,recordHash:r.recordHash,parentRecordHash:r.parentRecordHash,
    decision:r.decision,question:r.question?.question??null,path:r.question?.path??null,
    inheritedResults:r.history.length-1,sourceAccess:r.sources.map(s=>({url:s.url,access:s.access})),
    sandbox:r.sandbox?.status??'not_run',candidateHash:r.candidate?.candidateHash??null,
    sourceBranch:r.sourceBranch??null,productionPromotion:false,modelWeightInheritance:false,
    overallProjectAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const x=checkPacket(JSON.parse(fs.readFileSync('reports/autonomy.json','utf8')));
  const encoded=Buffer.from(canonical(x)).toString('base64');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'packet='+encoded+'\n');
  fs.writeFileSync('reports/autonomy-summary.json',JSON.stringify(summary(x),null,2));
  console.log(JSON.stringify(summary(x)));
}
