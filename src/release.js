/** Trusted deploy preparation. Generated programs cannot edit this file. */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hash,atomic } from './archive.js';
import { checkProgram,compile } from './program.js';
import { runSandbox } from './sandbox.js';
import { fixtures,comparison,accept,protocol } from './evaluation.js';
export async function prepareRelease(root,report){
  if(report?.decision!=='ADOPT_BOUNDED_MODULE'||report.mode!=='current-module')return {written:false,reason:'NOT_A_CURRENT_MODULE_ADOPTION'};
  const modulePath=path.join(root,'modules/response-extractor.json');
  const old=JSON.parse(fs.readFileSync(modulePath,'utf8'));
  if(hash(old)!==report.baselineHash||hash(report.program)!==report.candidateHash)throw new Error('ARTIFACT_OR_PARENT_CHANGED');
  if(report.specification?.version!==protocol.version||hash(report.specification)!==report.acceptanceHash)throw new Error('ACCEPTANCE_MISMATCH');
  if(Object.entries(protocol).some(([k,v])=>JSON.stringify(report.specification[k])!==JSON.stringify(v)))throw new Error('ACCEPTANCE_CHANGED');
  checkProgram(report.program);
  // Re-evaluate in this trusted job; never trust an uploaded PASS string.
  const comparisons=[];
  for(let i=0;i<2;i++){
    const rows=fixtures(randomBytes(24).toString('hex'),12),inputs=rows.map(x=>x.input);
    comparisons.push(comparison(rows,await runSandbox(old,inputs),await runSandbox(report.program,inputs)));
  }
  if(!accept(...comparisons))throw new Error('RELEASE_VALIDATION_FAILED');
  // Fixed allowlist: no arbitrary paths, scripts, evaluators or permissions.
  atomic(modulePath,report.program);
  fs.writeFileSync(path.join(root,'modules/response-extractor.js'),compile(report.program));
  const promotion={at:new Date().toISOString(),parent:report.baselineHash,child:report.candidateHash,exp:report.exp,scope:protocol.scope,previousProgram:old,verification:comparisons.map(c=>({n:c.after.n,pass:c.after.passed,delta:c.delta}))};
  atomic(path.join(root,'reports/module-promotion.json'),promotion);
  return {written:true,promotion};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=process.cwd(),report=JSON.parse(fs.readFileSync(path.join(root,'reports/latest.json'),'utf8'));
  console.log(JSON.stringify(await prepareRelease(root,report)));
}
