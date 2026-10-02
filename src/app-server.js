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
      const files={'/':'web/index.html','/free-chat.js':'web/free-chat.js','/chat-worker.js':'web/chat-worker.js','/model-backend.js':'continuity/backend.js','/backend-policy.js':'web/backend-policy.js'};
      if(req.method==='GET'&&Object.hasOwn(files,url.pathname)){
        const html=url.pathname==='/';res.writeHead(200,{'Content-Type':html?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
          'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
        return res.end(fs.readFileSync(path.join(ROOT,files[url.pathname])));
      }
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,version:'0.4.0',revision:process.env.RENDER_GIT_COMMIT||'local',zeroCostMode:true});
      if(req.method==='GET'&&['/api/free/status','/api/status'].includes(url.pathname))return json(res,200,{version:'0.4.0',zeroCostMode:true,
        chat:'browser keyless remote inference; no local model startup',model:'Pollinations text API model=openai',
        research:await researchRecord(),paidInferenceEnabled:false,fullAppSelfRewrite:false,
        foundationTraining:'separate partial-weight CPU experiment; consult run evidence',
        independentExternalValidation:false,overallProjectAccepted:false});
      if(req.method==='POST'&&url.pathname==='/api/chat'){
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24000)return json(res,413,{error:'INPUT_TOO_LARGE'});}
        let body;try{body=JSON.parse(raw||'{}');}catch{return json(res,400,{error:'INVALID_JSON'});}
        if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>10)return json(res,400,{error:'INVALID_MESSAGES'});
        const clean=body.messages.map(m=>({role:m?.role,content:typeof m?.content==='string'?m.content.slice(0,2000):''}));
        if(clean.some(m=>!['user','assistant'].includes(m.role)||!m.content))return json(res,400,{error:'INVALID_MESSAGES'});
        const recent=clean.slice(-8).map(m=>(m.role==='user'?'ユーザー: ':'AI: ')+m.content).join('\n');
        const prompt='以下の会話に日本語で簡潔かつ正確に回答してください。事実と不確実性を区別してください。\n\n'+recent+'\nAI:';
        const q=new URLSearchParams({model:'openai',private:'true',referrer:'project-infinity-core.onrender.com',system:'You are Project Infinity. Reply in Japanese. Be concise and accurate. Do not claim you browsed the web or changed yourself unless the supplied conversation proves it.'});
        try{const upstream=await fetcher('https://text.pollinations.ai/'+encodeURIComponent(prompt)+'?'+q,{signal:AbortSignal.timeout(45000),headers:{Referer:'https://project-infinity-core.onrender.com/'}});
          if(!upstream.ok)return json(res,502,{error:'UPSTREAM_'+upstream.status});const reply=(await upstream.text()).trim().slice(0,8000);if(!reply)return json(res,502,{error:'EMPTY_UPSTREAM'});return json(res,200,{reply,provider:'pollinations',paid:false});}
        catch(e){return json(res,502,{error:'UPSTREAM_FAILED'});}
      }
      if(req.method==='GET'&&url.pathname==='/lab'){req.url='/';return old(req,res);}
      return old(req,res);
    }catch{if(!res.headersSent)return json(res,400,{error:'REQUEST_FAILED'});res.end();}
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const s=await createApplication();s.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Project Infinity Core 0.4 ready; no paid inference API'));}
