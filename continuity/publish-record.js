/** Fixed data-only record publication; no code application or model secrets. */
import fs from 'node:fs';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const REPO='kou971223/project-infinity',REF='heads/research-records';
export function packageRecord(candidate,sources,applied,runId,event){
 if(!/^[0-9]+$/.test(runId)||!['push','schedule','workflow_dispatch'].includes(event))throw Error('RUN_PROVENANCE');
 if(candidate?.schema!=='PINF-BACKEND-REPORT-1'||!['NO_CHANGE','REJECT','ADOPT_BOUNDED_RUNTIME'].includes(candidate.decision)||sources?.schema!=='PINF-SOURCES-1')throw Error('RECORD_SCHEMA');
 if(applied&&candidate.decision!=='ADOPT_BOUNDED_RUNTIME')throw Error('UNSUPPORTED_APPLIED_CLAIM');
 const record={schema:'PINF-RUNTIME-PUBLIC-1',at:new Date().toISOString(),runId,event,decision:candidate.decision,applied:applied===true,
  candidate, sources,chatModelUpdated:false,overallProjectAccepted:false};
 if(Buffer.byteLength(JSON.stringify(record))>48000)throw Error('RECORD_SIZE');
 return {...record,recordHash:createHash('sha256').update(JSON.stringify(record)).digest('hex')};
}
export async function publish(record,{token=process.env.GH_TOKEN,fetcher=globalThis.fetch}={}){
 if(!token)throw Error('PUBLICATION_CREDENTIAL_MISSING');
 const base='https://api.github.com/repos/'+REPO;
 async function api(path,method='GET',body){const r=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28',Accept:'application/vnd.github+json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('PUBLISH_HTTP_'+r.status);return r.json();}
 const ref=await api('/git/ref/'+REF),parent=await api('/git/commits/'+ref.object.sha);
 const content=JSON.stringify(record,null,2)+'\n';
 const paths=['runtime/latest.json','runtime/runs/'+record.runId+'.json'];
 const tree=await api('/git/trees','POST',{base_tree:parent.tree.sha,tree:paths.map(path=>({path,mode:'100644',type:'blob',content}))});
 const commit=await api('/git/commits','POST',{message:'research: preserve verified runtime cycle '+record.runId,tree:tree.sha,parents:[ref.object.sha]});
 await api('/git/refs/'+REF,'PATCH',{sha:commit.sha,force:false});return {commit:commit.sha,branch:'research-records'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const record=packageRecord(JSON.parse(fs.readFileSync('reports/backend-candidate.json','utf8')),JSON.parse(fs.readFileSync('reports/runtime-sources.json','utf8')),process.env.RUNTIME_APPLIED==='true',process.env.GITHUB_RUN_ID,process.env.GITHUB_EVENT_NAME);
 console.log(JSON.stringify(await publish(record)));
}
