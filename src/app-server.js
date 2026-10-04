/** Keyless local-chat surface. Existing laboratory endpoints remain available. */
import {infer,PROVIDER} from './keyless-inference.js';
import {createEvolution} from '../evolution/runtime.js';
import {createPacer} from './request-pacer.js';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function createApplication({legacyFactory=null,fetcher=globalThis.fetch,...options}={}) {
  const evolution=createEvolution({fetcher});
  const factory=legacyFactory||(await import('./server.js')).createServer;
  const server=factory({...options,fetcher});const old=server.listeners('request')[0];server.removeListener('request',old);
  let cached=null,cacheUntil=0,inflight=0;const clients=new Map(),pace=createPacer();
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
      const files={'/':'web/index.html','/free-chat.js':'web/free-chat.js','/chat-state.js':'web/chat-state.js','/chat-worker.js':'web/chat-worker.js','/model-backend.js':'continuity/backend.js','/backend-policy.js':'web/backend-policy.js'};
      if(req.method==='GET'&&Object.hasOwn(files,url.pathname)){
        const html=url.pathname==='/';res.writeHead(200,{'Content-Type':html?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
          'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
        return res.end(fs.readFileSync(path.join(ROOT,files[url.pathname])));
      }
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,version:'0.8.0',revision:process.env.RENDER_GIT_COMMIT||'local',zeroCostMode:true});
      if(req.method==='GET'&&['/api/free/status','/api/status'].includes(url.pathname))return json(res,200,{version:'0.8.0',zeroCostMode:true,
        chat:'browser keyless remote inference; no local model startup',model:PROVIDER,conversationStorage:'this browser only; no cloud sync',
        research:await researchRecord(),paidInferenceEnabled:false,fullAppSelfRewrite:false,
        foundationTraining:'separate partial-weight CPU experiment; consult run evidence',
        independentExternalValidation:false,overallProjectAccepted:false});
      if(req.method==='GET'&&url.pathname==='/api/evolution/status'){await evolution.refresh();return json(res,200,evolution.status());}
      if(req.method==='POST'&&url.pathname==='/api/chat'){
        const origin=req.headers.origin;
        if(origin&&new URL(origin).host!==req.headers.host)return json(res,403,{error:'ORIGIN_DENIED'});
        if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'JSON_REQUIRED'});
        let n=0;const chunks=[];for await(const chunk of req){n+=chunk.length;if(n>65536)return json(res,413,{error:'INPUT_TOO_LARGE'});chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{return json(res,400,{error:'INVALID_JSON'});}
        const {validateMessages}=await import('./keyless-inference.js');
        try{validateMessages(body.messages);}catch(e){return json(res,e.status,{error:e.message});}
        const now=Date.now(),client=req.socket.remoteAddress||'unknown';
        for(const [key,value] of clients)if(value.until<now)clients.delete(key);
        const count=clients.get(client)||{until:now+60000,n:0};
        if(inflight>=4||count.n>=20)return json(res,429,{error:'RATE_LIMITED',retryAfterSeconds:60});
        count.n++;clients.set(client,count);inflight++;
        const abort=new AbortController(),onClose=()=>{if(!res.writableEnded)abort.abort();};res.on('close',onClose);
        try{const learned=await evolution.answer(body.messages.at(-1).content);
          if(learned.reply!==null&&(body.messages.length===1||/^計算[:：]/.test(body.messages.at(-1).content.trim()))){if(!res.destroyed)return json(res,200,{reply:learned.reply,provider:'Project ∞ verified capability',paid:false,evolution:learned});return;}
          await pace(abort.signal);const knowledge=await evolution.context();const answer=await infer(body.messages,{fetcher,signal:abort.signal,extract:server.extractResponse,knowledge});if(!res.destroyed)return json(res,200,{...answer,evolution:evolution.status()});}
        catch(e){if(!res.destroyed)return json(res,e.status||502,{error:e.message,retryable:e.status!==400});}
        finally{inflight--;res.off('close',onClose);}
        return;
      }
      if(req.method==='GET'&&url.pathname==='/lab'){req.url='/';return old(req,res);}
      return old(req,res);
    }catch{if(!res.headersSent)return json(res,400,{error:'REQUEST_FAILED'});res.end();}
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const s=await createApplication();s.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Project Infinity Core 0.4 ready; no paid inference API'));}
