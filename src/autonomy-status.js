import {checkPacket,summary} from '../autonomy/packet.mjs';
const URL='https://raw.githubusercontent.com/kou971223/project-infinity/research-records/autonomy/latest.json';
export async function readBounded(response,limit=160000){
  if(!response.body?.getReader)throw Error('RECORD_BODY');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>limit){await reader.cancel();throw Error('RECORD_SIZE');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}
export function createAutonomyReader({fetcher=globalThis.fetch,now=Date.now}={}){
  let cached=null,expires=0,inflight=null;
  return async function read(){
    if(cached&&now()<expires)return cached;
    if(inflight)return inflight;
    inflight=(async()=>{
      try{
        const res=await fetcher(URL,{redirect:'error',signal:AbortSignal.timeout(8000)});
        if(!res.ok)throw Error('RECORD_HTTP_'+res.status);
        const record=checkPacket(JSON.parse(await readBounded(res)));
        cached={...summary(record),checkedAt:new Date(now()).toISOString(),
          sourceRecordAgeHours:Math.max(0,Math.floor((now()-Date.parse(record.at))/3600000)),
          stale:!Number.isFinite(Date.parse(record.at))||now()-Date.parse(record.at)>13*3600000,
          scheduleObserved:record.event==='schedule',
          schedule:'six-hour source-research schedule; availability and timing not guaranteed'};
        expires=now()+120000;
      }catch(e){
        cached=cached?.available?{...cached,stale:true,lastReadError:e.message}:
          {available:false,reason:e.message,overallProjectAccepted:false,scheduleObserved:false};
        expires=now()+30000;
      }finally{inflight=null;}
      return cached;
    })();
    return inflight;
  };
}
