import fs from 'node:fs';
const read=f=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;
const learning=read('reports/local-learning.json')||{status:'error',error:'LEARNING_PROCESS_DID_NOT_COMPLETE'};
const record={version:'0.4.0',learning,candidate:read('reports/local-candidate.json'),evaluation:read('reports/model-latest.json'),checkpoint:read('reports/norm-checkpoint.json'),upstreamLicense:null,overallProjectAccepted:false};
if(record.checkpoint){
  const u='https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/resolve/7ae557604adf67be50417f59c2c2f167def9a775/LICENSE';
  const r=await fetch(u,{signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('LICENSE_ACCESS_REQUIRED_FOR_WEIGHT_PUBLICATION');
  record.upstreamLicense=await r.text();
  if(!record.upstreamLicense.includes('Apache License'))throw new Error('LICENSE_UNEXPECTED');
}
const raw=JSON.stringify(record);
if(Buffer.byteLength(raw)>180000)throw new Error('PUBLIC_RECORD_SIZE_LIMIT');
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/public-record.json',raw);
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'record='+Buffer.from(raw).toString('base64')+'\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Local model: '+learning.status+'\nWeight change: '+String(learning.result?.weightsChanged??'unknown')+'\nCandidate: '+String(record.evaluation?.decision??'not evaluated')+'\nScope: bounded experiment only; no overall completion claim.\n');
