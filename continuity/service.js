/** Read-only public evidence integration. Never accepts publication credentials or user text. */
import {createProjectStatus} from './project-status.js';
import {createHash} from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function brief(record){
 if(record?.schema!=='PINF-RUNTIME-PUBLIC-1'||typeof record.runId!=='string')throw Error('RECORD_SCHEMA');
 const {recordHash,...body}=record;if(recordHash!==createHash('sha256').update(JSON.stringify(body)).digest('hex'))throw Error('RECORD_HASH');
 return {available:true,at:record.at,event:record.event,runId:record.runId,decision:record.decision,applied:record.applied===true,
 sourceCount:record.sources?.sourceCount??0,sources:(record.sources?.items||[]).slice(0,5).map(x=>({title:String(x.title).slice(0,300),url:String(x.url).slice(0,500),status:x.status})),
 scope:'browser model startup recovery; not general intelligence',overallProjectAccepted:false};
}
export async function createContinuityApplication({factory=null,fetcher=globalThis.fetch,...options}={}){
 const build=factory||(await import('../autonomy/app.js')).createAutonomyApplication;
 const server=await build({...options,fetcher}),old=server.listeners('request')[0];server.removeListener('request',old);
 let cache=null,until=0;const projectStatus=createProjectStatus(fetcher);
 const json=(res,x)=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(x));};
 async function status(){
  if(cache&&Date.now()<until)return cache;
  try{
   const r=await fetcher('https://raw.githubusercontent.com/kou971223/project-infinity/research-records/runtime/latest.json',{signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!r.ok)throw Error('RECORD_HTTP_'+r.status);const chunks=[];let n=0;const reader=r.body.getReader();
   for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>50000){await reader.cancel();throw Error('RECORD_SIZE');}chunks.push(value);}
   cache=brief(JSON.parse(Buffer.concat(chunks).toString('utf8')));until=Date.now()+60000;
  }catch(e){cache={available:false,reason:e.message,overallProjectAccepted:false};until=Date.now()+10000;}
  return cache;
 }
 server.on('request',async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&url.pathname==='/health')return json(res,{ok:true,version:'0.8.0',uiRevision:'keyless-history-1',revision:process.env.RENDER_GIT_COMMIT||'local',zeroCostMode:true});
   if(req.method==='GET'&&url.pathname==='/api/runtime/status')return json(res,await status());
   if(req.method==='GET'&&url.pathname==='/api/project/status')return json(res,await projectStatus());
   if(req.method==='GET'&&url.pathname==='/continuity-ui.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(path.join(ROOT,'continuity/ui.js')));}
   if(req.method==='GET'&&url.pathname==='/'){
    const html=fs.readFileSync(path.join(ROOT,'web/index.html'),'utf8');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    // Research records are fetched on demand in a separate dialog, not injected into the conversation.
    return res.end(html);
   }
   return old(req,res);
  }catch{if(!res.headersSent)res.writeHead(500);res.end('RUNTIME_STATUS_UNAVAILABLE');}
 });return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const s=await createContinuityApplication();s.listen(Number(process.env.PORT||3000),'0.0.0.0');}
