import {setTimeout as delay} from 'node:timers/promises';
/** Respect anonymous quota: reserve start slots rather than concurrent bursts. */
export function createPacer({intervalMs=16000,clock=Date.now,wait=delay}={}){
 let next=0;
 return async signal=>{const now=clock(),slot=Math.max(now,next);next=slot+intervalMs;
  if(slot>now)await wait(slot-now,undefined,{signal});
  if(signal?.aborted)throw signal.reason;
 };
}
/** One anonymous inference at a time; a completed response starts the next cooldown. */
export function createInferenceQueue({gapMs=16000,clock=Date.now,wait=delay}={}){
 let tail=Promise.resolve(),next=0;
 return (run,signal)=>{
  const work=tail.then(async()=>{if(signal?.aborted)throw signal.reason;
   const remaining=next-clock();if(remaining>0)await wait(remaining,undefined,{signal});
   if(signal?.aborted)throw signal.reason;
   try{return await run();}finally{next=clock()+gapMs;}
  });tail=work.catch(()=>{});return work;
 };
}
