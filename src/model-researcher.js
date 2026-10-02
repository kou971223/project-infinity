import fs from 'node:fs';
import path from 'node:path';
import { runResearchCycle } from './research-cycle.js';
import { atomic } from './archive.js';

const endpoint='https://models.github.ai/inference/chat/completions';
const token=process.env.GITHUB_TOKEN;
const model=process.env.RESEARCH_MODEL || 'openai/gpt-4o';
const ROOT=path.resolve(process.cwd());

function extractJson(text){
  const m=String(text||'').match(/\{[\s\S]*\}/);
  if(!m) throw new Error('MODEL_JSON_MISSING');
  return JSON.parse(m[0]);
}
function validateEnvelope(x){
  if(!x||typeof x!=='object'||typeof x.hypothesis!=='string'||!Array.isArray(x.program))throw new Error('MODEL_SCHEMA');
  if(x.hypothesis.length<10||x.hypothesis.length>1200)throw new Error('MODEL_HYPOTHESIS_SIZE');
  return {hypothesis:x.hypothesis,program:x.program};
}

export async function generateModelCandidate({fetcher=globalThis.fetch}={}){
  if(!token)return {status:'UNAVAILABLE',reason:'GITHUB_TOKEN_MISSING'};
  const approved=fs.readFileSync(path.join(ROOT,'modules/response-extractor.json'),'utf8');
  const prompt=[
    'You are a bounded Project Infinity research candidate generator.',
    'Propose ONE candidate only for the response-text-extraction DSL.',
    'Do not change evaluator, thresholds, workflow, permissions, files, network, or privileges.',
    'The executable DSL supports only: input, get, map_get, flatmap_get, filter_eq, join, trim, first_nonempty.',
    'Allowed fields: output_text, output, type, content, text, role.',
    'Allowed filter literals: message, output_text, assistant.',
    'Return strict JSON only: {"hypothesis":"...","program":[...]}.',
    'Current approved program: '+approved
  ].join('\n');
  const res=await fetcher(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:0.2,max_tokens:1200}),
    signal:AbortSignal.timeout(45000)
  });
  if(!res.ok)throw new Error('MODEL_HTTP_'+res.status);
  const body=await res.json();
  const content=body?.choices?.[0]?.message?.content;
  const candidate=validateEnvelope(extractJson(content));
  return {status:'GENERATED',model,candidate};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
  const generated=await generateModelCandidate();
  if(generated.status!=='GENERATED'){
    console.log(JSON.stringify(generated));process.exit(0);
  }
  const dir=path.join(ROOT,'.runtime','model-'+Date.now());
  const report=await runResearchCycle({
    dir,
    externalCandidate:{program:generated.candidate.program,hypothesis:generated.candidate.hypothesis},
    fetchSource:true
  });
  report.modelResearch={
    provider:'GitHub Models',
    model:generated.model,
    hypothesis:generated.candidate.hypothesis,
    authority:'candidate-generator-only; no promotion/evaluator authority'
  };
  fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});
  atomic(path.join(ROOT,'reports','model-latest.json'),report);
  console.log(JSON.stringify({decision:report.decision,exp:report.exp,model:generated.model,scope:report.mode},null,2));
}
