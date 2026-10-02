import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { candidates, legacyProgram, checkProgram, compile } from './program.js';
import { runSandbox } from './sandbox.js';
import { fixtures, comparison, score, accept, protocol } from './evaluation.js';
import { Archive, atomic, hash } from './archive.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const approved=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'modules/response-extractor.json'),'utf8'));
export const sourceRecord={
  id:'SRC-OPENAI-TEXT-20261002',url:'https://developers.openai.com/api/docs/guides/text',
  type:'official-documentation',sourceStatus:'active_at_access',accessDate:'2026-10-02',
  claim:'Raw Responses output may contain multiple item types; SDK output_text is a convenience aggregation.',
  initialVerification:'Read via browser research tool; no independent replication implied.',
  applicationConvention:'Newline joining, trimming, and malformed-input handling are this application contract, not universal API guarantees.'
};

export async function collectSource(fetcher=globalThis.fetch){
  const row={...sourceRecord,runtimeAccess:'unknown',rawSha256:null};
  try {
    const res=await fetcher(sourceRecord.url,{signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!res.ok)throw new Error('HTTP_'+res.status);
    const reader=res.body.getReader();let size=0;const chunks=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error('SOURCE_SIZE');}chunks.push(value);}
    row.rawSha256=hash(Buffer.concat(chunks).toString('utf8'));row.bytes=size;row.runtimeAccess='fetched';
  }catch(e){row.runtimeAccess='access_unavailable';row.error=e.message;}
  // Content is stored as evidence metadata; never evaluated as instructions.
  return row;
}

/** Runs a real synthesis / isolated execution / heldout-validation cycle.
 * rehearsal=true replays the OLD shortcut-only bug; it never downgrades live code.
 * No general intelligence or E4/RSI claim is made by this experiment.
 */
export async function runResearchCycle({dir=path.join(ROOT,'.runtime'),rehearsal=false,externalCandidate=null,fetchSource=false}={}){
  fs.mkdirSync(dir,{recursive:true});const lock=path.join(dir,'cycle.lock');
  let lockFd;try{lockFd=fs.openSync(lock,'wx');}catch{throw new Error('CYCLE_BUSY');}
  try {
    const archive=new Archive(dir);const parent=archive.seed(rehearsal?legacyProgram():approved());
    const exp='EXP-'+randomUUID(),start=Date.now();
    const source=fetchSource?await collectSource():{...sourceRecord,runtimeAccess:'not_requested',rawSha256:null};
    const specification={...protocol,baselineHash:parent.id,mode:rehearsal?'legacy-bug-rehearsal':'current-module',sourceId:source.id};
    const acceptanceHash=hash(specification);
    archive.append('PREREGISTER',{exp,specification,acceptanceHash});
    archive.append('SOURCE',source);
    const dev=fixtures('public-development-v1',protocol.devRepeats);
    const baselineDev=await runSandbox(parent.program,dev.map(x=>x.input));
    const initialScore=score(dev,baselineDev);
    let best={program:parent.program,hash:parent.id,score:initialScore,complexity:checkProgram(parent.program).nodes};
    const attempts=[];
    const proposals=externalCandidate?[externalCandidate.program]:[...candidates()];
    if(proposals.length>protocol.maxCandidates)throw new Error('SEARCH_BUDGET');
    for(const program of proposals){
      const id=hash(program);
      try{
        const complexity=checkProgram(program).nodes;
        const outputs=await runSandbox(program,dev.map(x=>x.input));
        const result=score(dev,outputs);
        attempts.push({hash:id,passed:result.passed,n:result.n,complexity});
        if(result.passed>best.score.passed||(result.passed===best.score.passed&&complexity<best.complexity))best={program,hash:id,score:result,complexity};
      }catch(e){attempts.push({hash:id,rejected:true,reason:e.message});}
    }
    archive.append('SELECTION',{exp,attempts,selectedHash:best.hash,role:'development; not confirmatory evidence'});
    if(best.hash===parent.id||best.score.passed<=initialScore.passed){
      const report={version:'0.2.0',exp,mode:specification.mode,decision:'NO_CHANGE',candidateOrigin:externalCandidate?'external-model-unverified-origin':'enumerative-program-synthesis',source,acceptanceHash,attempts,baselineDev:initialScore,elapsedMs:Date.now()-start,claim:'No measured development gain; no holdout consumed and no mutation.'};
      archive.append('DECISION',report);atomic(path.join(dir,'report.json'),report);return report;
    }
    // Commit candidate identity BEFORE generating private random holdout seeds.
    best.program=JSON.parse(JSON.stringify(best.program));
    if(hash(best.program)!==best.hash)throw new Error('CANDIDATE_CHANGED');
    archive.append('CANDIDATE_FROZEN',{exp,hash:best.hash,program:best.program,acceptanceHash});
    const confirmSeed=randomBytes(24).toString('hex'), replicateSeed=randomBytes(24).toString('hex');
    const confirm=fixtures(confirmSeed,protocol.confirmRepeats),repl=fixtures(replicateSeed,protocol.replicationRepeats);
    archive.append('EVALUATION_SEALED',{exp,confirmSeedHash:hash(confirmSeed),replicationSeedHash:hash(replicateSeed),role:'freshly generated after freeze; public generator, unseen seeds'});
    const inputs=confirm.map(x=>x.input),rinputs=repl.map(x=>x.input);
    const cBase=await runSandbox(parent.program,inputs),cNew=await runSandbox(best.program,inputs);
    const rBase=await runSandbox(parent.program,rinputs),rNew=await runSandbox(best.program,rinputs);
    const c=comparison(confirm,cBase,cNew),r=comparison(repl,rBase,rNew);
    const pass=accept(c,r);
    const evidenceId='EVD-'+exp;
    archive.append('DEPENDENCY',{id:evidenceId,parents:[source.id,'CONTRACT-'+acceptanceHash]});
    archive.append('DEPENDENCY',{id:best.hash,parents:[evidenceId,parent.id]});
    archive.append('VALIDATION',{exp,hash:best.hash,acceptanceHash,pass,confirmatory:c,replication:r,evidenceId});
    if(pass)archive.promote(best.program,parent.id,[evidenceId],{role:'validator',verified:true});
    const report={
      version:'0.2.0',exp,mode:specification.mode,decision:pass?'ADOPT_BOUNDED_MODULE':'REJECT',
      candidateOrigin:externalCandidate?'external-model-unverified-origin':'enumerative-program-synthesis',
      hypothesis:'Structured raw-response traversal repairs shortcut-only response extraction without interpreting tool/refusal contents as answer text.',
      taxonomy:{version:'PINF-ICT-0.1',category:'E1',scope:'application reliability only; not learned model intelligence or E4/RSI'},
      baselineHash:parent.id,candidateHash:best.hash,program:best.program,acceptanceHash,specification,source,attempts,
      confirmatory:c,replication:r,elapsedMs:Date.now()-start,
      independence:{candidateEvaluatorCode:'separate',runtime:'isolated worker + non-evaluating capability-free DSL interpreter',hiddenAnswers:'not supplied to candidate',modelJudge:'none',commonDependencies:['contract','fixture generator','author'],externalReplication:'not performed'},
      resources:{candidateCount:attempts.length,developmentCasesPerCandidate:dev.length,confirmatoryCases:confirm.length,replicationCases:repl.length,inferenceCalls:0,financialCost:'no external model API invoked by enumerative mode',flops:'unknown',energy:'unknown'},
      limitations:['Synthetic format variants, not natural research tasks','Known legacy bug repair, not a novel intelligence breakthrough','Same research team and shared task construct','Rehearsal rollback restores legacy code only inside isolated rehearsal state'],
      exposure:{confirmatory:'consumed: report published after final decision; never re-use as untouched',seedsPublishedAfterDecision:true,confirmSeed,replicateSeed}
    };
    // Save inputs/outputs for a separately implemented Python oracle. Not exposed to candidates.
    atomic(path.join(dir,'oracle-input.json'),{cases:[...confirm,...repl],outputs:[...cNew,...rNew]});
    archive.append('DECISION',{exp,decision:report.decision,candidateHash:best.hash});
    report.audit=archive.verify();atomic(path.join(dir,'report.json'),report);
    if(pass)fs.writeFileSync(path.join(dir,'candidate-module.js'),compile(best.program));
    return report;
  }finally{fs.closeSync(lockFd);fs.unlinkSync(lock);}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const rehearsal=process.argv.includes('--rehearsal');
  const dir=path.join(ROOT,'.runtime',rehearsal?'rehearsal-'+Date.now():'current');
  const report=await runResearchCycle({dir,rehearsal,fetchSource:process.argv.includes('--fetch-source')});
  fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});
  atomic(path.join(ROOT,'reports',rehearsal?'rehearsal.json':'latest.json'),report);
  if(rehearsal&&fs.existsSync(path.join(dir,'oracle-input.json')))fs.copyFileSync(path.join(dir,'oracle-input.json'),path.join(ROOT,'reports','oracle-input.json'));
  console.log(JSON.stringify({decision:report.decision,exp:report.exp,scope:report.mode,baseline:report.confirmatory?.before.passed,candidate:report.confirmatory?.after.passed,n:report.confirmatory?.after.n,runtime:dir},null,2));
}
