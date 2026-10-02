/** PINF-BACKEND-1: capability-free program configuration, trusted executor.
 * Only three boolean decisions are evolvable. No generated host JS is evaluated.
 * This kernel has explicit dependencies so tests do not need a model or network.
 */
export const BASELINE = Object.freeze({preferGpu:true,recoverProbe:false,recoverLoad:false});
export function validatePolicy(p) {
  if (!p || Array.isArray(p) || Object.keys(p).sort().join(',') !== 'preferGpu,recoverLoad,recoverProbe' ||
      Object.values(p).some(v=>typeof v!=='boolean')) throw Error('POLICY_SCHEMA');
  return {...p};
}
export async function loadBackend(policy,{mode='auto',probe,load,notify=()=>{}}) {
  const p=validatePolicy(policy);
  if (!['auto','cpu'].includes(mode) || typeof probe!=='function'||typeof load!=='function') throw Error('BACKEND_INPUT');
  const attempts=[];let capable=false;
  const warn=reason=>{try{notify(reason);}catch{/* telemetry must not break inference */}};
  if(mode!=='cpu'&&p.preferGpu) {
    try{capable=(await probe())===true;}
    catch(e){if(!p.recoverProbe)throw e;warn('GPU_PROBE_FAILED');}
  }
  const tryLoad=async device=>{attempts.push(device);const generator=await load(device);if(!generator)throw Error('EMPTY_BACKEND');return generator;};
  if(capable) {
    try{return {generator:await tryLoad('webgpu'),device:'webgpu',attempts};}
    catch(e){if(!p.recoverLoad)throw e;warn('GPU_LOAD_FAILED');}
  }
  // Exactly one CPU attempt; no recursion, paid fallback, privilege changes or infinite retry.
  return {generator:await tryLoad('wasm'),device:'wasm',attempts};
}
