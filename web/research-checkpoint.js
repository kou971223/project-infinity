// Applies only an independently published, accepted experimental checkpoint.
// Browser model remains usable if the checkpoint cannot be loaded.
export async function loadAcceptedResearchCheckpoint({fetcher=fetch}={}){
  const r=await fetcher('/api/research/checkpoint',{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok)return null;
  const x=await r.json();
  if(!x?.available||x?.status!=='accepted_experimental'||!Array.isArray(x.values)||x.values.length!==896)return null;
  if(!Number.isInteger(x.generation)||x.generation<1)return null;
  return x;
}
export function checkpointBanner(x){return x?('研究世代 '+x.generation+'（検証済み実験重み）'):'公開会話モデル';}
