/** Keyless local-chat surface. Existing laboratory endpoints remain available. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function createApplication({legacyFactory=null,fetcher=globalThis.fetch,...options}={}) {
  const factory=legacyFactory||(await import('./server.js')).createServer;
  const server=factory({...options,fetcher});const old=server.listeners('request')[0];server.removeListener('request',old);
  let cached=null,cacheUntil=0;
  const json=(res,status,x)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(x));};
  async function researchRecord(){
    if(Date.now()<cacheUntil)return cached;
    cacheUntil=Date.now()+300000;
    try{
      const url='https://raw.githubusercontent.com/kou971223/project-infinity/research-records/research/latest.json';
      const r=await fetcher(url,{signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw new Error('RECORD_HTTP_'+r.status);
      const text=await r.text();if(Buffer.byteLength(text)>200000)throw new Error('RECORD_SIZE');
      const data=JSON.parse(text),{recordHash,publication,...body}=data;
      const actual=createHash('sha256').update(JSON.stringify(body)).digest('hex');
      if(actual!==recordHash)throw new Error('RECORD_HASH_MISMATCH');
      cached={available:true,at:publication?.at,runId:publication?.runId,learningStatus:data.learning?.status,
        weightsChanged:data.learning?.result?.weightsChanged===true,
        parameterCount:data.learning?.training?.parameterCountChanged??null,
        learningDecision:data.learning?.result?.decision??null,
        codeDecision:data.evaluation?.decision??null,chatModelUpdated:false,overallProjectAccepted:false};
    }catch(e){cached={available:false,reason:e.message,overallProjectAccepted:false};}
    return cached;
  }
  server.on('request',async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const files={'/':'web/index.html','/free-chat.js':'web/free-chat.js','/chat-worker.js':'web/chat-worker.js'};
      if(req.method==='GET'&&Object.hasOwn(files,url.pathname)){
        const html=url.pathname==='/';res.writeHead(200,{'Content-Type':html?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
          'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
        return res.end(fs.readFileSync(path.join(ROOT,files[url.pathname])));
      }
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,version:'0.4.0',revision:process.env.RENDER_GIT_COMMIT||'local',zeroCostMode:true});
      if(req.method==='GET'&&['/api/free/status','/api/status'].includes(url.pathname))return json(res,200,{version:'0.4.0',zeroCostMode:true,
        chat:'browser-local model; requires initial download and device support',model:'Qwen2.5-0.5B-Instruct',
        research:await researchRecord(),paidInferenceEnabled:false,fullAppSelfRewrite:false,
        foundationTraining:'separate partial-weight CPU experiment; consult run evidence',
        independentExternalValidation:false,overallProjectAccepted:false});
      if(req.method==='POST'&&url.pathname==='/api/chat'){req.resume();return json(res,503,{error:'ZERO_COST_MODE_USE_LOCAL_CHAT'});}
      if(req.method==='GET'&&url.pathname==='/lab'){req.url='/';return old(req,res);}
      return old(req,res);
    }catch{if(!res.headersSent)return json(res,400,{error:'REQUEST_FAILED'});res.end();}
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const s=await createApplication();s.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Project Infinity Core 0.4 ready; no paid inference API'));}
