import {validateManifest} from './manifest.js';
import {installModelBridge} from './stream.js';
import {MODEL,REVISION} from './config.js';
/** Returns only after the actual loader consumed the verified, patched model bytes. */
export async function loadAcceptedChat(library,{forceBase=false,progress=()=>{},fetcher=fetch}={}){
 if(forceBase)return {generator:null,reason:'USER_SELECTED_BASE'};
 let manifest;
 try{const r=await fetcher('/api/chat-release',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('RELEASE_HTTP');const text=await r.text();if(text.length>100000)throw Error('RELEASE_SIZE');manifest=await validateManifest(JSON.parse(text));}
 catch(e){return {generator:null,reason:'NO_VALIDATED_RELEASE',detail:e.message};}
 let cache=null;try{cache=await caches.open('transformers-cache');}catch{}
 const receipt={},restore=installModelBridge(library.env,manifest,{cache,fetcher,receipt,onProgress:p=>{if(p.verifiedBytes===p.totalBytes)progress({type:'progress',file:'学習済み重みの検証完了',progress:100});}});
 let generator=null;
 try{
  generator=await library.pipeline('text-generation',MODEL,{revision:REVISION,device:'wasm',dtype:'q8',progress_callback:p=>progress({type:'progress',file:p.file||'',progress:p.progress??null,status:p.status})});
  if(!receipt.applied||receipt.weightHash!==manifest.weightHash)throw Error('PATCH_NOT_CONSUMED');
  return {generator,device:'wasm',manifest,receipt};
 }catch(e){await generator?.dispose().catch(()=>{});return {generator:null,reason:'RELEASE_LOAD_FAILED_USING_BASE',detail:String(e.message).slice(0,200)};}
 finally{restore();}
}
