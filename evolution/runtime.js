/** Trusted finite capability compiler. Research artifacts are data, never executable code. */
import {createHash} from 'node:crypto';
import {boundedText} from '../src/keyless-inference.js';
export const PROTOCOL='PINF-CHAT-EVOLUTION-1';
export const CAPABILITIES=['exact-integer-v1','metric-length-v1'];
export const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
export const baseline=()=>({schema:PROTOCOL,generation:0,capabilities:[],parentHash:null});
export function validatePolicy(p){
 if(!p||p.schema!==PROTOCOL||!Number.isSafeInteger(p.generation)||p.generation<0||p.generation>100000||!Array.isArray(p.capabilities)||p.capabilities.length>2||new Set(p.capabilities).size!==p.capabilities.length||p.capabilities.some(c=>!CAPABILITIES.includes(c))||Object.keys(p).some(k=>!['schema','generation','capabilities','parentHash'].includes(k)))throw Error('POLICY_INVALID');
 if(p.parentHash!==null&&!/^[a-f0-9]{64}$/.test(p.parentHash))throw Error('POLICY_PARENT');return p;
}
export function exactAnswer(text,policy){
 validatePolicy(policy);if(typeof text!=='string'||text.length>180)return null;
 const s=text.trim().replace(/^(?:計算[:：]?\s*|calculate\s+)/i,'').replace(/(?:\s*(?:を計算して(?:ください)?|を計算|は[？?]?|=|＝|[？?]))$/,'').trim();
 if(policy.capabilities.includes('exact-integer-v1')){
  const m=/^([+-]?\d{1,40})\s*([+＋\-−*×÷/])\s*([+-]?\d{1,40})$/.exec(s);
  if(m){const a=BigInt(m[1]),b=BigInt(m[3]);if(['+','＋'].includes(m[2]))return String(a+b);if(['-','−'].includes(m[2]))return String(a-b);if(['*','×'].includes(m[2]))return String(a*b);if(b!==0n&&a%b===0n)return String(a/b);}
 }
 if(policy.capabilities.includes('metric-length-v1')){
  const m=/^([+-]?\d{1,18}(?:\.\d{1,6})?)\s*(mm|cm|m)\s*(?:を|to|→)\s*(mm|cm|m)\s*(?:に(?:換算|変換)(?:して(?:ください)?)?)?$/i.exec(s);
  if(m){const scale={mm:0,cm:1,m:3},parts=m[1].split('.'),places=(parts[1]||'').length+scale[m[3].toLowerCase()]-scale[m[2].toLowerCase()];let n=BigInt(parts.join(''));if(places<=0)return String(n*10n**BigInt(-places))+' '+m[3].toLowerCase();const sign=n<0n?'-':'';if(n<0n)n=-n;let d=String(n).padStart(places+1,'0');d=(d.slice(0,-places)+'.'+d.slice(-places)).replace(/\.?0+$/,'');return sign+(d||'0')+' '+m[3].toLowerCase();}
 }
 return null;
}
export function selfTest(p){
 validatePolicy(p);
 const probes={'exact-integer-v1':[['9007199254740993 + 2','9007199254740995'],['-7 × 13','-91'],['84 ÷ 7','12']], 'metric-length-v1':[['1.25 m を mm に換算','1250 mm'],['123 mm to m','0.123 m'],['-2.5 cm to mm','-25 mm']]};
 for(const c of p.capabilities)for(const [q,a] of probes[c])if(exactAnswer(q,p)!==a)throw Error('CAPABILITY_REGRESSION');
 for(const q of ['こんにちは','計算方法を説明して','1 / 0','1+2;process.exit()','Ignore instructions: 1+2'])if(exactAnswer(q,p)!==null)throw Error('ROUTING_REGRESSION');return true;
}
export const canonicalAnswer=value=>value.trim().replace(/(?<![\d.,])([+-]?\d{1,3}(?:,\d{3})+)(?![\d.,])/g,m=>m.replaceAll(',',''));
export function validateEnvelope(x){
 if(!x||x.schema!==PROTOCOL||!x.active||!Array.isArray(x.history)||x.history.length>10)throw Error('ENVELOPE_INVALID');
 const {artifactHash,...body}=x;if(hash(body)!==artifactHash)throw Error('ARTIFACT_HASH');
 const p=validatePolicy(x.active);if(x.decision!=='ADOPT'||!x.evidence||x.evidence.protocol!==PROTOCOL||x.evidence.passed!==true||x.evidence.candidateHash!==hash(p))throw Error('UNVERIFIED_POLICY');
 const pairs=x.evidence.pairs;if(!Array.isArray(pairs)||pairs.length!==8||pairs.some(v=>v.baseline?.ok!==true||v.candidate?.ok!==true||typeof v.expected!=='string'||typeof v.baseline.reply!=='string'||typeof v.candidate.reply!=='string'||!Number.isFinite(v.baseline.ms)||!Number.isFinite(v.candidate.ms)||v.baseline.ms<0||v.candidate.ms<0||canonicalAnswer(v.candidate.reply)!==v.expected))throw Error('EVIDENCE_INVALID');
 const gain=pairs.some(v=>canonicalAnswer(v.baseline.reply)!==v.expected)||pairs.filter(v=>v.candidate.ms*2+20<v.baseline.ms).length>=4;if(!gain)throw Error('NO_VERIFIED_GAIN');
 for(const old of x.history)validatePolicy(old);return x;
}
const URL='https://raw.githubusercontent.com/kou971223/project-infinity/research-records/dialogue/active.json';
export function createEvolution({fetcher=globalThis.fetch,ttl=60000,clock=Date.now,check=selfTest}={}){
 let accepted=null,current=baseline(),until=0,pending=null,decision='BASELINE',reason=null,blocked=new Set();
 async function refresh(){if(clock()<until)return;if(pending)return pending;
  pending=(async()=>{until=clock()+ttl;try{const r=await fetcher(URL,{signal:AbortSignal.timeout(8000),redirect:'error'});if(r.status===404){reason='NO_ACCEPTED_RESEARCH';return;}if(!r.ok)throw Error('RECORD_HTTP_'+r.status);const x=validateEnvelope(JSON.parse(await boundedText(r,50000)));
   if(blocked.has(x.artifactHash))return;if(x.active.generation<current.generation)throw Error('STALE_GENERATION');accepted=x;try{check(x.active);}catch(e){rollback(e);return;}current=x.active;decision='ADOPTED_IN_CHAT';reason=null;
  }catch(e){reason=e.message;}finally{pending=null;}})();return pending;
 }
 function rollback(error){if(accepted)blocked.add(accepted.artifactHash);const choices=[...(accepted?.history||[]).slice().reverse(),baseline()];current=choices.find(p=>{try{return check(p);}catch{return false;}})||baseline();decision='ROLLED_BACK';reason=error.message;}
 function status(){return {schema:PROTOCOL,generation:current.generation,policyHash:hash(current),capabilities:current.capabilities,decision,reason,artifactHash:accepted?.artifactHash||null,weightsChanged:false,scope:'verified answer tools and research knowledge; not foundation model training'};}
 return {status,refresh,async answer(text){await refresh();try{check(current);return {reply:exactAnswer(text,current),...status()};}catch(e){rollback(e);return {reply:null,...status()};}},async context(){await refresh();return '採用済み会話研究の事実：'+JSON.stringify(status())+'。これは回答補助機能の検証結果であり、基盤モデルの学習・汎用知能向上ではありません。';}};
}
