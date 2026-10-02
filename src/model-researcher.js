/** Replaces the retired GitHub Models API. No paid API fallback is permitted. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCandidate } from './local-candidate.js';
export async function runLocalCandidate(root=process.cwd()) {
  const out=path.join(root,'reports/model-latest.json');
  let report;
  try {
    const source=JSON.parse(fs.readFileSync(path.join(root,'reports/local-candidate.json'),'utf8'));
    if(source.status!=='generated_unvalidated') throw new Error('GENERATION_NOT_COMPLETED');
    const candidate=parseCandidate(source.text);
    const {checkProgram}=await import('./program.js');
    checkProgram(candidate.program);
    const {runResearchCycle}=await import('./research-cycle.js');
    report=await runResearchCycle({dir:path.join(root,'.runtime','local-model-'+Date.now()),externalCandidate:candidate,fetchSource:true});
    report.modelResearch={provider:'local CPU; no inference API',model:source.model,revision:source.revision,hypothesis:candidate.hypothesis};
  } catch(e) {
    report={version:'0.4.0',decision:'REJECT_OR_UNAVAILABLE',reason:e.message,
      scope:'response-text-extraction',promoted:false,overallProjectAccepted:false};
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
  console.log(JSON.stringify({decision:report.decision,reason:report.reason||null,scope:'response-text-extraction'}));
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) await runLocalCandidate();
