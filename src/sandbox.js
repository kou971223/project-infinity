import { Worker } from 'node:worker_threads';
import { checkProgram } from './program.js';
export async function runSandbox(program,inputs,{timeoutMs=6000}={}) {
  checkProgram(program);
  if(!Array.isArray(inputs)||inputs.length>1000||Buffer.byteLength(JSON.stringify(inputs))>2000000) throw new Error('BATCH_LIMIT');
  return await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./worker.js',import.meta.url),{
      workerData:{program,inputs},env:{},resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:8,stackSizeMb:2}
    });
    let done=false;
    const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();err?reject(err):resolve(result);};
    const timer=setTimeout(()=>finish(new Error('SANDBOX_TIMEOUT')),timeoutMs);
    worker.once('message',m=>m.error?finish(new Error(m.error)):finish(null,m.outputs));
    worker.once('error',e=>finish(e));
    worker.once('exit',code=>{if(!done)finish(new Error('SANDBOX_EXIT_'+code));});
  });
}
