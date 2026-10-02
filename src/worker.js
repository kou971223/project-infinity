import { parentPort,workerData } from 'node:worker_threads';
import { execute } from './program.js';
// Only a checked program and input values are provided. No expected answers,
// acceptance thresholds, archive, credentials, lineage or promotion handles.
try {
  const outputs=workerData.inputs.map(input=>{
    try {return {ok:true,...execute(workerData.program,input)};}
    catch(e){return {ok:false,error:e.message};}
  });
  parentPort.postMessage({outputs});
} catch(e){parentPort.postMessage({error:e.message});}
