/** Read-only live evidence panel; no inference service or write credential. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function summarize(x){
 if(x?.schema!=='PINF-AUTONOMY-1'||typeof x.runId!=='string'||!['completed','error'].includes(x.runStatus))throw Error('INVALID_STATUS');
 return {available:true,at:x.at,runId:x.runId,event:x.event,runStatus:x.runStatus,decision:x.decision,
  generationBefore:x.generationBefore,generationAfter:x.generationAfter,inheritedAcceptedCheckpoint:x.inheritedAcceptedCheckpoint===true,
  sourceStatus:x.sourceStatus,sourceBranch:typeof x.sourceBranch==='string'&&/^research-source\/[0-9]+-[0-9]+$/.test(x.sourceBranch)?x.sourceBranch:null,
  literatureAccess:x.literatureAccess,chatModelUpdated:false,overallProjectAccepted:false};
}
export async function createAutonomyApplication({factory=null,fetcher=globalThis.fetch,...options}={}){
 const build=factory||(await import('../src/app-server.js')).createApplication;
 const s=await build({...options,fetcher}),old=s.listeners('request')[0];s.removeListener('request',old);
 let cached=null,until=0;
 async function status(){
  if(cached&&Date.now()<until)return cached;
  try{
   const r=await fetcher('https://raw.githubusercontent.com/kou971223/project-infinity/research-records/autonomy/status.json',{signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!r.ok)throw Error('RECORD_HTTP_'+r.status);
   const reader=r.body.getReader();let n=0;const chunks=[];
   for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>20000){await reader.cancel();throw Error('RECORD_SIZE');}chunks.push(value);}
   cached=summarize(JSON.parse(Buffer.concat(chunks).toString('utf8')));until=Date.now()+60000;
  }catch(e){cached={available:false,reason:e.message};until=Date.now()+10000;}
  return cached;
 }
 s.on('request',async(req,res)=>{
  try{
   const u=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&u.pathname==='/health'){
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true,version:'0.5.0',revision:process.env.RENDER_GIT_COMMIT||'local',zeroCostMode:true}));
   }
   if(req.method==='GET'&&u.pathname==='/api/autonomy/status'){
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(await status()));
   }
   if(req.method==='GET'&&u.pathname==='/autonomy.js'){
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});return res.end(fs.readFileSync(path.join(ROOT,'autonomy/ui.js')));
   }
   if(req.method==='GET'&&u.pathname==='/'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer'});
    const html=fs.readFileSync(path.join(ROOT,'web/index.html'),'utf8');
    return res.end(html.replace('Core 0.4','Core 0.5').replace('</body>','<script type="module" src="/autonomy.js"></script></body>'));
   }
   return old(req,res);
  }catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"STATUS_UNAVAILABLE"}');}
 });return s;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const s=await createAutonomyApplication();s.listen(Number(process.env.PORT||3000),'0.0.0.0');}
