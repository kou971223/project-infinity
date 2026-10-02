/** Trusted publisher. Model output never chooses a ref/path/command. */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const REPO='kou971223/project-infinity', BRANCH='research-records';
export function checkedRecord(raw) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>180000) throw new Error('RECORD_TOO_LARGE');
  const record=JSON.parse(raw);
  if(record?.version!=='0.4.0'||!['completed','error'].includes(record.learning?.status))throw new Error('RECORD_SCHEMA');
  return record;
}
export async function publish(raw,token,fetcher=globalThis.fetch) {
  const record=checkedRecord(raw);
  if(!token)throw new Error('PUBLICATION_TOKEN_MISSING');
  async function api(route,method='GET',body=null,allow404=false) {
    const r=await fetcher('https://api.github.com/repos/'+REPO+route,{method,
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    if(allow404&&r.status===404)return null;
    if(!r.ok)throw new Error('GITHUB_HTTP_'+r.status);
    return r.status===204?null:r.json();
  }
  let ref=await api('/git/ref/heads/'+BRANCH,'GET',null,true);
  if(!ref){const main=await api('/git/ref/heads/main');ref=await api('/git/refs','POST',{ref:'refs/heads/'+BRANCH,sha:main.object.sha});}
  const parent=ref.object.sha, commit=await api('/git/commits/'+parent);
  const runId=process.env.GITHUB_RUN_ID||String(Date.now());
  if(!/^\d{1,24}$/.test(runId))throw new Error('INVALID_RUN_ID');
  const digest=createHash('sha256').update(raw).digest('hex');
  const content=JSON.stringify({...record,recordHash:digest,publication:{parent,runId,at:new Date().toISOString()}},null,2);
  const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[
    {path:'research/latest.json',mode:'100644',type:'blob',content},
    {path:'research/history/'+runId+'.json',mode:'100644',type:'blob',content}
  ]});
  const next=await api('/git/commits','POST',{message:'record: free CPU research '+runId,tree:tree.sha,parents:[parent]});
  await api('/git/refs/heads/'+BRANCH,'PATCH',{sha:next.sha,force:false});
  return {published:true,branch:BRANCH,commit:next.sha,recordHash:digest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const raw=process.env.RESEARCH_RECORD_B64?Buffer.from(process.env.RESEARCH_RECORD_B64,'base64').toString('utf8'):fs.readFileSync('reports/public-record.json','utf8');
  console.log(JSON.stringify(await publish(raw,process.env.GH_TOKEN)));
}
