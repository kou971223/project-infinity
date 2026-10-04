import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { execute } from './program.js';
import { Archive,hash } from './archive.js';
import { oracle } from './evaluation.js';
import { runResearchCycle } from './research-cycle.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const approved=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'modules/response-extractor.json'),'utf8'));
export function extractGuarded(archive,response){
  const active=archive.active();let output;
  try{output=execute(active.program,response).value;}catch{output=null;}
  const expected=oracle(response);
  if(output!==expected){
    archive.append('RUNTIME_REGRESSION',{candidate:active.id,inputHash:hash(response),rawInputStored:false});
    if(active.parent)archive.rollback('runtime_contract_regression',{role:'validator'});
    // Fail-safe result comes from the separate trusted reference, not the failed code.
    output=expected;
  }
  return output;
}

export function createServer({dataDir=path.join(ROOT,'.runtime','web'),fetcher=globalThis.fetch}={}){
  const archive=new Archive(dataDir);archive.seed(approved());
  let latest=null,busy=false,nextLab=0;
  const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const body=async req=>{let size=0,parts=[];for await(const p of req){size+=p.length;if(size>65536)throw new Error('BODY_LIMIT');parts.push(p);}return JSON.parse(Buffer.concat(parts).toString()||'{}');};
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const origin=req.headers.origin;
      if(req.method==='POST'&&origin&&new URL(origin).host!==req.headers.host)return reply(res,403,{error:'ORIGIN_DENIED'});
      if(req.method==='GET'&&url.pathname==='/'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer'});
        return res.end(fs.readFileSync(path.join(ROOT,'src/ui.html'),'utf8'));
      }
      if(req.method==='GET'&&url.pathname==='/health')return reply(res,200,{ok:true,version:'0.2.0',revision:process.env.RENDER_GIT_COMMIT||'local',module:archive.active().id});
      if(req.method==='GET'&&url.pathname==='/api/status')return reply(res,200,{
        version:'0.2.0',activeModule:archive.active().id,audit:archive.verify(),busy,
        capabilities:{executableProgramSynthesis:true,isolatedEvaluation:true,boundedAdoption:true,rollback:true,externalModelConfigured:false,foundationTraining:false,arbitraryAppRewrite:false},
        storage:process.env.RENDER?'ephemeral local runtime; committed release evidence survives redeploy':'local-filesystem',
        schedule:'see GitHub Actions; a cron definition is not evidence of completed future runs',
        humanOrExternalIndependentReplication:false,defaultGenerator:'enumerative program synthesis, not an LLM'
      });
      if(req.method==='GET'&&url.pathname==='/api/result'){
        const f=path.join(ROOT,'reports','release.json');return reply(res,200,latest||(fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null));
      }
      if(req.method==='POST'&&url.pathname==='/api/extract'){
        const input=await body(req);return reply(res,200,{text:extractGuarded(archive,input),module:archive.active().id});
      }
      if(req.method==='POST'&&(url.pathname==='/api/lab'||url.pathname==='/api/research-cycle')){
        await body(req);if(busy||Date.now()<nextLab)return reply(res,429,{error:'実験実行中、または間隔制限中です。少し待ってください。'});
        busy=true;nextLab=Date.now()+60000;
        try{
          const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pinf-rehearsal-'));
          try{latest=await runResearchCycle({dir:temp,rehearsal:true});}finally{fs.rmSync(temp,{recursive:true,force:true});}
          return reply(res,200,latest);
        }finally{busy=false;}
      }
      if(req.method==='POST'&&url.pathname==='/api/chat')return reply(res,410,{error:'USE_KEYLESS_APPLICATION'});
      return reply(res,404,{error:'NOT_FOUND'});
    }catch(e){return reply(res,400,{error:['BODY_LIMIT','INPUT_SIZE','OUTPUT_CONTRACT','STEP_LIMIT'].includes(e.message)?e.message:'REQUEST_FAILED'});}
  });
  server.extractResponse=response=>extractGuarded(archive,response);
  server.requestTimeout=70000;return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){createServer().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Project Infinity Core 0.2 ready'));}
