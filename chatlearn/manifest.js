import {PROTOCOL,ASSET,MODEL,REVISION,LIMITS} from './config.js';
export const canonical=x=>{
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'){if(!Number.isFinite(x))throw Error('NONFINITE');return JSON.stringify(x);}
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 throw Error('INVALID_CANONICAL_VALUE');
};
export async function sha256(data){const b=typeof data==='string'?new TextEncoder().encode(data):data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function floatBytes(values){
 if(!Array.isArray(values)||values.length!==LIMITS.values||values.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>100))throw Error('NORM_VALUES');
 const b=new Uint8Array(values.length*4),v=new DataView(b.buffer);values.forEach((x,i)=>v.setFloat32(i*4,x,true));return b;
}
function losses(row,n){for(const key of ['before','after'])if(!Array.isArray(row?.[key])||row[key].length!==n||row[key].some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0))throw Error('INVALID_LOSS');return row.before.map((x,i)=>x-row.after[i]);}
export function judge(e){
 const d=losses(e?.target,LIMITS.targetCases),a=losses(e?.anchors,LIMITS.anchorCases),b=e?.behavior;
 if(!Array.isArray(b)||b.length!==LIMITS.behaviorCases||b.some(x=>typeof x.beforePass!=='boolean'||typeof x.afterPass!=='boolean'))throw Error('INVALID_BEHAVIOR');
 const gain=d.reduce((s,x)=>s+x,0)/d.length,worstAnchor=Math.max(...a.map(x=>-x)),meanAnchor=-a.reduce((s,x)=>s+x,0)/a.length;
 const baselinePassed=b.filter(x=>x.beforePass).length,regressions=b.filter(x=>x.beforePass&&!x.afterPass).length;
 return {pass:gain>=LIMITS.minGain&&Math.min(...d)>0&&worstAnchor<=LIMITS.maxAnchorIncrease&&meanAnchor<=LIMITS.maxMeanAnchorIncrease&&baselinePassed>=LIMITS.minBaselineBehaviorPasses&&regressions===0,gain,worstAnchor,meanAnchor,baselinePassed,regressions};
}
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export async function validateManifest(m){
 if(!m||m.schema!=='PINF-CHAT-RELEASE-1'||m.protocol!==PROTOCOL||m.status!=='accepted_experimental'||m.model!==MODEL||m.revision!==REVISION||m.device!=='wasm'||m.dtype!=='q8')throw Error('RELEASE_IDENTITY');
 if(canonical(m.asset)!==canonical(ASSET)||!Number.isInteger(m.generation)||m.generation<1||m.generation>3)throw Error('ASSET_IDENTITY');
 const bytes=floatBytes(m.values);if(await sha256(bytes)!==m.weightHash||!hex(m.patchedModelHash)||!hex(m.sourceRecordHash))throw Error('WEIGHT_IDENTITY');
 if(m.values.some(x=>Math.fround(x)!==x))throw Error('NON_FLOAT32');
 if(!Array.isArray(m.baseChunkHashes)||m.baseChunkHashes.length!==Math.ceil(ASSET.bytes/ASSET.chunkSize)||!m.baseChunkHashes.every(hex)||!hex(m.patchedChunkHash))throw Error('CHUNK_IDENTITIES');
 if(m.measurementRevision!=='PINF-CHAT-WASM-EVAL-1')throw Error('MEASUREMENT_BACKEND');
 if(!judge(m.evidence).pass||m.actualOnnxEvaluation!==true||m.trainingStatus!=='accepted_experimental')throw Error('RELEASE_EVIDENCE');
 const {releaseHash,...body}=m;if(!hex(releaseHash)||await sha256(canonical(body))!==releaseHash)throw Error('RELEASE_HASH');
 return m;
}
