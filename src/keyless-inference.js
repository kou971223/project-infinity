/** Fixed anonymous endpoint. No credentials, paid fallback, prompt URLs or logs. */
export const PROVIDER = Object.freeze({name:'Pollinations.AI',model:'openai-fast',
  reportedModel:'GPT-OSS 20B Reasoning LLM (OVH)',identitySource:'https://text.pollinations.ai/models',
  checkedAt:'2026-10-04',tier:'anonymous',endpoint:'https://text.pollinations.ai/openai',
  modelIdentity:'provider-reported; weights not independently inspected',guaranteedFreeAvailability:false});
export class InferenceError extends Error {
  constructor(code,status=502){super(code);this.status=status;}
}
export function validateMessages(messages){
  if(!Array.isArray(messages)||!messages.length||messages.length>10)throw new InferenceError('INVALID_MESSAGES',400);
  const clean=messages.map(m=>{
    if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>8000)throw new InferenceError('INVALID_MESSAGES',400);
    return {role:m.role,content:m.content};
  });
  if(clean.at(-1).role!=='user'||JSON.stringify(clean).length>20000)throw new InferenceError('INVALID_MESSAGES',400);
  return clean;
}
export async function boundedText(response,maxBytes=65536){
  const reader=response.body.getReader();let n=0;const parts=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;
    if(n>maxBytes)throw new InferenceError('UPSTREAM_TOO_LARGE');parts.push(value);}
  }finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(parts).toString('utf8');
}
export async function infer(messages,{fetcher=globalThis.fetch,signal,system,extract}={}){
  const clean=validateMessages(messages);
  const instruction=system||'あなたはProject ∞の会話アシスタントです。日本語で質問に正確に答えてください。事実と推測を区別してください。Web検索や自分の改修・学習を実行したと主張しないでください。会話モデルの重みはこのアプリでは更新できません。';
  try{
    const r=await fetcher(PROVIDER.endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({model:PROVIDER.model,private:true,messages:[{role:'system',content:instruction},...clean]}),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
    if(!r.ok)throw new InferenceError(r.status===429?'UPSTREAM_BUSY':r.status===401||r.status===402?'KEYLESS_UNAVAILABLE':'UPSTREAM_HTTP_'+r.status,r.status===429?503:502);
    let data;try{data=JSON.parse(await boundedText(r));}catch(e){if(e instanceof InferenceError)throw e;throw new InferenceError('INVALID_UPSTREAM');}
    if(data.error)throw new InferenceError('UPSTREAM_ERROR');
    const choice=data.choices?.[0];
    if(choice?.finish_reason!=='stop')throw new InferenceError('INCOMPLETE_UPSTREAM');
    const content=typeof choice.message?.content==='string'?choice.message.content:'';
    const canonical={output:[{type:'message',content:[{type:'output_text',text:content}]}]};
    const reply=extract?extract(canonical):content.trim();
    if(!reply)throw new InferenceError('INVALID_UPSTREAM');
    if(reply.length>8000)throw new InferenceError('UPSTREAM_TOO_LARGE');
    return {reply,provider:PROVIDER.name,model:PROVIDER.model,reportedModel:typeof data.model==='string'?data.model.slice(0,100):null,paid:false};
  }catch(e){if(e instanceof InferenceError)throw e;
    if(signal?.aborted)throw new InferenceError('CANCELLED',499);
    throw new InferenceError(e.name==='TimeoutError'?'UPSTREAM_TIMEOUT':'UPSTREAM_FAILED');}
}
