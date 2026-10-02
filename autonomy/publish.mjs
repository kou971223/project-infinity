/** Trusted publisher: data branch and candidate branch only; cannot merge or deploy. */
import {pathToFileURL} from 'node:url';
import {canonical,digest,checkPacket,checkCandidate,summary} from './packet.mjs';
const REPO='kou971223/project-infinity';
export async function publish(packet,{token=process.env.GH_TOKEN,fetcher=globalThis.fetch}={}){
  const input=checkPacket(packet);
  if(!token)throw Error('PUBLICATION_CREDENTIAL_MISSING');
  async function api(route,method='GET',body=null,optional=false){
    const res=await fetcher('https://api.github.com/repos/'+REPO+'/'+route,{
      method,redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{})});
    if(optional&&res.status===404)return null;
    if(!res.ok)throw Error('GITHUB_'+res.status);
    return res.json();
  }
  const stateRef=await api('git/ref/heads/research-records');
  const stateCommit=await api('git/commits/'+stateRef.object.sha);
  const old=await api('contents/autonomy/latest.json?ref='+stateRef.object.sha,'GET',null,true);
  const previous=old?checkPacket(JSON.parse(Buffer.from(old.content,'base64').toString('utf8'))):null;
  if(previous?.publication?.inputRecordHash===input.recordHash)return {alreadyPublished:true,...summary(previous)};
  if((previous?.recordHash??null)!==input.parentRecordHash||input.generation!==(previous?.generation??0)+1)throw Error('STALE_LINEAGE');
  let sourceBranch=null,branchStatus='not_eligible';
  if(input.candidate&&input.decision==='REVIEW_READY'&&input.sandbox?.status==='passed'){
    const c=checkCandidate(input.candidate,input.sourceCommit);
    const current=await api('git/ref/heads/main');
    if(current.object.sha!==input.sourceCommit){branchStatus='stale_source; no code branch written';}
    else{
      const base=await api('git/commits/'+input.sourceCommit);
      const elements=[];
      for(const f of c.changes){
        const blob=await api('contents/'+f.path+'?ref='+input.sourceCommit);
        if(blob.type!=='file'||blob.encoding!=='base64')throw Error('SOURCE_TYPE');
        const before=Buffer.from(blob.content,'base64').toString('utf8');
        if(digest(before)!==f.beforeHash||before.split(f.before).length!==2||before.replace(f.before,f.after)!==f.content)throw Error('SOURCE_PARENT_CHANGED');
        elements.push({path:f.path,mode:'100644',type:'blob',content:f.content});
      }
      const branch='candidate/generated-'+c.candidateHash.slice(0,20);
      const existing=await api('git/ref/heads/'+branch,'GET',null,true);
      if(existing){
        const oldCommit=await api('git/commits/'+existing.object.sha);
        if(!oldCommit.message?.includes('candidateHash='+c.candidateHash))throw Error('BRANCH_COLLISION');
      }else{
        const tree=await api('git/trees','POST',{base_tree:base.tree.sha,tree:elements});
        const commit=await api('git/commits','POST',{message:'research candidate: review only; NOT promoted\ncandidateHash='+c.candidateHash,tree:tree.sha,parents:[input.sourceCommit]});
        await api('git/refs','POST',{ref:'refs/heads/'+branch,sha:commit.sha});
      }
      sourceBranch=branch;branchStatus='review_branch_created; no merge or deployment';
    }
  }
  const {recordHash:ignored,...body}=input;
  const published={...body,sourceBranch,branchStatus,publication:{at:new Date().toISOString(),inputRecordHash:input.recordHash}};
  published.recordHash=digest(published);checkPacket(published);
  const content=canonical(published);
  const tree=await api('git/trees','POST',{base_tree:stateCommit.tree.sha,tree:[
    {path:'autonomy/latest.json',mode:'100644',type:'blob',content},
    {path:'autonomy/records/'+input.runId+'-'+published.recordHash.slice(0,16)+'.json',mode:'100644',type:'blob',content}
  ]});
  const commit=await api('git/commits','POST',{message:'research evidence: generation '+input.generation+'; '+input.decision,tree:tree.sha,parents:[stateRef.object.sha]});
  // Non-force CAS: a concurrent evidence write causes a conflict, never lost history.
  await api('git/refs/heads/research-records','PATCH',{sha:commit.sha,force:false});
  return {published:true,...summary(published)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_REPOSITORY!==REPO)throw Error('UNTRUSTED_PUBLICATION_REF');
  const b64=process.env.AUTONOMY_PACKET_B64||'';
  if(!/^[A-Za-z0-9+/=]+$/.test(b64)||b64.length>220000)throw Error('PACKET_ENCODING');
  const record=JSON.parse(Buffer.from(b64,'base64').toString('utf8'));
  console.log(JSON.stringify(await publish(record)));
}
