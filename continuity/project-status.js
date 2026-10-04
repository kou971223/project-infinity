import {boundedText,PROVIDER} from '../src/keyless-inference.js';
const BASE='https://raw.githubusercontent.com/kou971223/project-infinity/research-records/';
export function createProjectStatus(fetcher=globalThis.fetch){
 let cache,until=0,pending;
 return async function(){
  if(cache&&Date.now()<until)return cache;if(pending)return pending;
  pending=(async()=>{
   const definitions=[
    ['learning','部分学習・世代・Lineage','autonomy/status.json','PINF-AUTONOMY-1'],
    ['runtime','限定コードの検証・採用','runtime/latest.json','PINF-RUNTIME-PUBLIC-1'],
    ['source','公開コードの仮説・Candidate・独立検証','source/status.json','PINF-SOURCE-1'],
    ['dialogue','会話へ反映する検証済み能力','dialogue/status.json','PINF-CHAT-EVOLUTION-1']];
   const lanes=await Promise.all(definitions.map(async([id,label,path,schema])=>{
    try{const r=await fetcher(BASE+path,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw Error('HTTP_'+r.status);
     const x=JSON.parse(await boundedText(r,80000));if(x.schema!==schema)throw Error('RECORD_SCHEMA');
     const stale=!Number.isFinite(Date.parse(x.at))||Date.now()-Date.parse(x.at)>86400000;
     return {id,label,available:true,at:x.at,runId:x.runId,event:x.event,stale,
      decision:x.decision||'UNKNOWN',generationBefore:x.generationBefore??null,generationAfter:x.generationAfter??null,
      applied:x.applied===true,sourceStatus:x.sourceStatus||null,
      summary:id==='learning'?(x.decision==='DEFER_EPOCH_HOLDOUT_REVIEW'?'第3世代の固定上限で保留。評価基準の再設計前に追加採用しません。':'研究用重みのみ。会話モデルへ未反映。'):id==='runtime'?'旧端末内モデルの起動用コード。現在の会話経路では使用しません。':x.summary,
      archiveUrl:'https://github.com/kou971223/project-infinity/tree/research-records/'+(id==='learning'?'autonomy':id)};
    }catch(e){return {id,label,available:false,reason:e.message};}
   }));
   cache={version:'0.8.0',provider:PROVIDER,lanes,overallProjectAccepted:false,completionStatus:'EXPERIMENTAL_PARTIAL',
    chatModelUpdated:false,autonomy:'bounded scheduled research; no guaranteed always-on compute',
    knowledgeArchive:'public repository evidence only; no conversation uploads',
    rollback:'bounded extractor runtime regression rollback; source proposals never auto-promoted',
    sourceAuthority:'candidate cannot edit validators, tests, workflows, criteria, or active production',
    physicalIPhoneVerified:false};until=Date.now()+60000;return cache;
  })();try{return await pending;}finally{pending=null;}
 };
}
