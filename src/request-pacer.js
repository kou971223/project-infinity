import {setTimeout as delay} from 'node:timers/promises';
/** Respect anonymous quota: reserve start slots rather than concurrent bursts. */
export function createPacer({intervalMs=16000,clock=Date.now,wait=delay}={}){
 let next=0;
 return async signal=>{const now=clock(),slot=Math.max(now,next);next=slot+intervalMs;
  if(slot>now)await wait(slot-now,undefined,{signal});
  if(signal?.aborted)throw signal.reason;
 };
}
