/** Streaming patch: only a verified 3.5 KB tensor is changed, never the graph or other weights.
 * Chunk validation avoids a second 512 MB in-memory model copy. No generated code is evaluated.
 */
import {ASSET,MODEL_URL} from './config.js';
import {sha256,floatBytes} from './manifest.js';
export function verifiedModelResponse(response,m,{receipt={},onProgress=()=>{},asset=ASSET}={}){
 if(!response?.ok||!response.body)throw Error('MODEL_DOWNLOAD');
 const reader=response.body.getReader(),replacement=floatBytes(m.values);
 let buffer=new Uint8Array(asset.chunkSize),filled=0,left=null,index=0,total=0,finished=false;
 const expectedChunks=Math.ceil(asset.bytes/asset.chunkSize),targetIndex=Math.floor(asset.offset/asset.chunkSize);
 receipt.applied=false;receipt.verifiedChunks=0;
 const stream=new ReadableStream({
  async pull(controller){
   try{
    while(filled<buffer.length){
     let v=left;left=null;
     if(!v){const r=await reader.read();if(r.done){finished=true;break;}v=r.value;}
     const n=Math.min(v.length,buffer.length-filled);buffer.set(v.subarray(0,n),filled);filled+=n;if(n<v.length)left=v.subarray(n);
    }
    if(!filled){if(!finished||total!==asset.bytes||index!==expectedChunks)throw Error('MODEL_TRUNCATED');receipt.applied=true;receipt.weightHash=m.weightHash;receipt.releaseHash=m.releaseHash;controller.close();return;}
    if(index>=expectedChunks||total+filled>asset.bytes)throw Error('MODEL_OVERSIZE');
    const b=buffer.subarray(0,filled);if(await sha256(b)!==m.baseChunkHashes[index])throw Error('MODEL_CHUNK_HASH');
    if(index===targetIndex){
     const offset=asset.offset-total;
     if(offset<0||offset+asset.length>b.length)throw Error('TENSOR_OFFSET');
     if(await sha256(b.subarray(offset,offset+asset.length))!==asset.normHash)throw Error('ORIGINAL_NORM_HASH');
     b.set(replacement,offset);if(await sha256(b)!==m.patchedChunkHash)throw Error('PATCHED_CHUNK_HASH');
    }
    total+=filled;index++;receipt.verifiedChunks=index;onProgress({verifiedBytes:total,totalBytes:asset.bytes});
    controller.enqueue(b);buffer=new Uint8Array(asset.chunkSize);filled=0;
   }catch(e){receipt.applied=false;await reader.cancel().catch(()=>{});controller.error(e);}
  },cancel(reason){receipt.applied=false;return reader.cancel(reason);}
 });
 return new Response(stream,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(asset.bytes)}});
}
export function installModelBridge(env,manifest,{cache=null,fetcher=fetch,receipt={},onProgress}={}){
 const old={useBrowserCache:env.useBrowserCache,useCustomCache:env.useCustomCache,customCache:env.customCache};
 env.useBrowserCache=false;env.useCustomCache=true;
 env.customCache={
  async match(request){
   const key=typeof request==='string'?request:request.url;
   if(key===MODEL_URL){
    let r=cache?await cache.match(key):null;
    if(!r){r=await fetcher(MODEL_URL);if(!r.ok)throw Error('MODEL_HTTP_'+r.status);if(cache)cache.put(key,r.clone()).catch(()=>{});}
    return verifiedModelResponse(r,manifest,{receipt,onProgress});
   }
   return cache?cache.match(request):undefined;
  },
  async put(request,response){const key=typeof request==='string'?request:request.url;if(key===MODEL_URL)return;return cache?.put(request,response);}
 };
 return ()=>Object.assign(env,old);
}
