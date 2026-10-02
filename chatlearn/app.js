/** Read-only model release service. User text and write credentials never enter it. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateManifest} from './manifest.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function createChatLearningApplication({factory=null,fetcher=globalThis.fetch,manifestProvider=null,...options}={}){
 const build=factory||(await import('../continuity/service.js')).createContinuityApplication;
 const s=await build({...options,fetcher}),old=s.listeners('request')[0];s.removeListener('request',old);
 let cache=null,until=0;
 async function release(){
  if(cache&&Date.now()<until)return cache;
  try{
   let m;if(manifestProvider)m=await manifestProvider();else{
    const r=await fetcher('https://raw.githubusercontent.com/kou971223/project-infinity/research-records/chatlearn/active.json',{signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!r.ok)throw Error('NO_RELEASE_RECORD');let bytes=0;const chunks=[];const reader=r.body.getReader();
    for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>100000){await reader.cancel();throw Error('RELEASE_SIZE');}chunks.push(value);}
    m=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   }
   cache=await validateManifest(m);until=Date.now()+60000;
  }catch(e){cache={schema:'PINF-CHAT-RELEASE-1',status:'unavailable',reason:e.message,overallProjectAccepted:false};until=Date.now()+15000;}
  return cache;
 }
 const json=(res,x)=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(x));};
 const scripts=new Set(['config.js','manifest.js','stream.js','client.js']);
 s.on('request',async(req,res)=>{
  try{
   const u=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&u.pathname==='/api/chat-release')return json(res,await release());
   if(req.method==='GET'&&u.pathname==='/api/chat-learning/status'){
    const m=await release();return json(res,{available:m.status==='accepted_experimental',releaseHash:m.releaseHash||null,weightHash:m.weightHash||null,generation:m.generation||null,
     scope:'896 trained normalization parameters; evaluated on fixed compatibility tasks; not general intelligence or RSI',device:'wasm',reason:m.reason||null,overallProjectAccepted:false});
   }
   if(req.method==='GET'&&u.pathname==='/health')return json(res,{ok:true,version:'0.7.0',revision:process.env.RENDER_GIT_COMMIT||'local',zeroCostMode:true});
   if(req.method==='GET'&&u.pathname.startsWith('/chatlearn/')&&scripts.has(u.pathname.slice(11))){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(path.join(ROOT,'chatlearn',u.pathname.slice(11))));}
   if(req.method==='GET'&&u.pathname==='/'){
    let html=fs.readFileSync(path.join(ROOT,'web/index.html'),'utf8').replace('Core 0.4','Core 0.7');
    html=html.replace('研究で作った重みは、このチャットには自動適用していません。','研究で作った重みは、会話用の追加検証に合格した版だけ起動時に読み込みます。現在読み込んだ版は起動表示で確認できます。');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    return res.end(html.replace('</body>','<script type="module" src="/autonomy.js"></script><script type="module" src="/continuity-ui.js"></script></body>'));
   }
   return old(req,res);
  }catch{if(!res.headersSent)res.writeHead(500);res.end('MODEL_RELEASE_UNAVAILABLE');}
 });return s;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const testing=process.env.PINF_CHAT_BRIDGE_TEST==='1'&&process.env.NODE_ENV!=='production';
 const provider=testing?()=>JSON.parse(fs.readFileSync(path.join(ROOT,'reports/chat-release.test.json'),'utf8')):null;
 const s=await createChatLearningApplication({manifestProvider:provider});s.listen(Number(process.env.PORT||3000),testing?'127.0.0.1':'0.0.0.0');
}
