/** Synthesize an actual backend-loader program; causal evidence is fault-injection only. */
import fs from 'node:fs';import path from 'node:path';import {createHash,randomBytes,randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {validatePolicy,loadBackend} from './backend.js';
export const PROTOCOL=Object.freeze({id:'PINF-BACKEND-ACC-1',candidateCount:8,developmentRepeats:1,confirmRepeats:8,replicateRepeats:8,requiredPassRate:1,allowedRegressions:0,minGain:0.05,scope:'local-model startup recovery only',stopping:'one frozen selected candidate; two new independent seed streams; no post-result tuning'});
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const normalize=p=>{const x=validatePolicy(p);return {preferGpu:x.preferGpu,recoverProbe:x.recoverProbe,recoverLoad:x.recoverLoad};};
export function compile(p){return '// Generated from a validated PINF-BACKEND-1 program; not LLM instructions.\nexport default Object.freeze('+JSON.stringify(normalize(p))+');\n';}
export function proposals(){const out=[];for(const preferGpu of [false,true])for(const recoverProbe of [false,true])for(const recoverLoad of [false,true])out.push({preferGpu,recoverProbe,recoverLoad});return out;}
const scenarios=[
 ['gpu_available','auto',true,false,false,'webgpu'],
 ['no_gpu','auto',false,false,false,'wasm'],
 ['probe_failed','auto','throw',false,false,'wasm'],
 ['gpu_failed','auto',true,true,false,'wasm'],
 ['cpu_requested','cpu',true,false,false,'wasm'],
 ['cpu_skips_broken_probe','cpu','throw',false,false,'wasm'],
 ['both_failed','auto',true,true,true,'error'],
 ['cpu_failed','auto',false,false,true,'error'],
 ['gpu_ok_cpu_unavailable','auto',true,false,true,'webgpu'],
 ['probe_and_cpu_failed','auto','throw',false,true,'error'],
 ['nonboolean_probe','auto','yes',false,false,'wasm'],
 ['telemetry_failed','auto',true,true,false,'wasm']
];
export async function evaluate(policy,seed,repeats=1) {
 const records=[];
 for(let r=0;r<repeats;r++)for(const [family,mode,probeResult,gpuFail,cpuFail,expected] of scenarios) {
   let probed=0;const calls=[];const id=hash(seed+'/'+family+'/'+r).slice(0,16);let result='error';
   const probe=async()=>{probed++;if(probeResult==='throw')throw Error(id);return probeResult;};
   const load=async device=>{calls.push(device);await new Promise(resolve=>setImmediate(resolve));if((device==='webgpu'&&gpuFail)||(device==='wasm'&&cpuFail))throw Error(id);return {id,device};};
   try{result=(await loadBackend(policy,{mode,probe,load,notify:()=>{if(family==='telemetry_failed')throw Error(id);}})).device;}catch{}
   const bounded=calls.length<=2&&calls.filter(x=>x==='wasm').length<=1&&probed<=1;
   const consent=mode!=='cpu'||(probed===0&&calls.every(x=>x==='wasm'));
   records.push({family,pass:result===expected&&bounded&&consent,calls:calls.length});
 }
 return {passed:records.filter(x=>x.pass).length,total:records.length,records};
}
export function compare(a,b){
 if(a.total!==b.total||a.records.length!==b.records.length)throw Error('MISSING_RUNS');
 return {baseline:a.passed,candidate:b.passed,total:a.total,gain:(b.passed-a.passed)/a.total,
  regressions:a.records.filter((x,i)=>x.pass&&!b.records[i].pass).length,
  familyCount:scenarios.length,scope:'synthetic backend-failure families; not human users or intelligence',
  providerCallsBefore:a.records.reduce((s,x)=>s+x.calls,0),providerCallsAfter:b.records.reduce((s,x)=>s+x.calls,0)};
}
export const acceptable=x=>x.candidate===x.total&&x.regressions===0&&x.gain>=PROTOCOL.minGain;
export async function research(parent) {
 const baseline=normalize(parent),start=Date.now(),initial=await evaluate(baseline,'development');
 let best=baseline,bestScore=initial.passed;const attempts=[];
 for(const p of proposals()){const s=await evaluate(p,'development');attempts.push({hash:hash(p),passed:s.passed,total:s.total});if(s.passed>bestScore){best=p;bestScore=s.passed;}}
 const frozen=normalize(best),report={schema:'PINF-BACKEND-REPORT-1',exp:'EXP-'+randomUUID(),at:new Date().toISOString(),protocol:PROTOCOL,protocolHash:hash(PROTOCOL),baseline,baselineHash:hash(baseline),candidate:frozen,candidateHash:hash(frozen),attempts,origin:'enumerative program synthesis; no LLM improvement claim',taxonomy:'E1 application reliability',overallProjectAccepted:false};
 if(bestScore<=initial.passed)return {...report,decision:'NO_CHANGE',elapsedMs:Date.now()-start};
 // Candidate identity frozen before either confirmatory seed is chosen.
 const c=randomBytes(24).toString('hex'),r=randomBytes(24).toString('hex');
 const comparisons=[];
 for(const seed of [c,r])comparisons.push(compare(await evaluate(baseline,seed,8),await evaluate(frozen,seed,8)));
 return {...report,decision:comparisons.every(acceptable)?'ADOPT_BOUNDED_RUNTIME':'REJECT',comparisons,seedsRevealedAfterDecision:[c,r],elapsedMs:Date.now()-start,
 independence:{separateMeasurement:true,externalIndependent:false,shared:['author','scenario families','executor']},
 confounders:['Failure recovery adds one CPU attempt after GPU failure; not equal-load compute','Real iPhone/GPU fault injection not performed','Timing is not a device-performance benchmark']};
}
export async function prepare(root,report) {
 if(report?.decision!=='ADOPT_BOUNDED_RUNTIME')return {written:false};
 const parent=normalize(JSON.parse(fs.readFileSync(path.join(root,'web/backend-policy.json'),'utf8'))),child=normalize(report.candidate);
 if(hash(parent)!==report.baselineHash||hash(child)!==report.candidateHash||hash(report.protocol)!==hash(PROTOCOL)||report.protocolHash!==hash(PROTOCOL))throw Error('STALE_OR_MUTATED_ARTIFACT');
 const checks=[];for(let i=0;i<2;i++){const seed=randomBytes(24).toString('hex');checks.push(compare(await evaluate(parent,seed,8),await evaluate(child,seed,8)));}
 if(!checks.every(acceptable))throw Error('INDEPENDENT_RELEASE_CHECK_FAILED');
 fs.mkdirSync(path.join(root,'reports'),{recursive:true});
 fs.writeFileSync(path.join(root,'web/backend-policy.json'),JSON.stringify(child)+'\n');
 fs.writeFileSync(path.join(root,'web/backend-policy.js'),compile(child));
 const record={...report,releaseChecks:checks,previousProgram:parent,appliedFiles:['web/backend-policy.json','web/backend-policy.js'],releaseAt:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID||'local',event:process.env.GITHUB_EVENT_NAME||'local'};
 fs.writeFileSync(path.join(root,'reports/backend-promotion.json'),JSON.stringify(record,null,2)+'\n');
 return {written:true,record};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.cwd();fs.mkdirSync('reports',{recursive:true});
 if(process.argv.includes('--prepare')){console.log(JSON.stringify(await prepare(root,JSON.parse(fs.readFileSync('reports/backend-candidate.json','utf8')))));}
 else {const report=await research(JSON.parse(fs.readFileSync('web/backend-policy.json','utf8')));fs.writeFileSync('reports/backend-candidate.json',JSON.stringify(report));console.log(JSON.stringify(report));}
}
