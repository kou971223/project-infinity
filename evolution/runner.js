import {infer} from '../src/keyless-inference.js';
import {exactAnswer,validatePolicy} from './runtime.js';
const input=JSON.parse(await new Promise(resolve=>{let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>resolve(s));}));
const start=performance.now();
try{validatePolicy(input.policy);let reply=exactAnswer(input.prompt,input.policy),mode='verified-tool',modelEvidence=null;if(reply===null){mode='external-model';const result=await infer([{role:'user',content:input.prompt+'\n答えだけを返してください。'}]);reply=result.reply;modelEvidence={provider:result.provider,model:result.model,reportedModel:result.reportedModel};}console.log(JSON.stringify({reply,mode,modelEvidence,ms:Math.ceil(performance.now()-start),ok:true}));}
catch(e){console.log(JSON.stringify({ok:false,error:e.message,ms:Math.ceil(performance.now()-start)}));}
