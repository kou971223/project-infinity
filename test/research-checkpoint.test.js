import test from 'node:test';import assert from 'node:assert/strict';
import {loadAcceptedResearchCheckpoint,checkpointBanner} from '../web/research-checkpoint.js';
test('rejects unavailable checkpoint',async()=>{const x=await loadAcceptedResearchCheckpoint({fetcher:async()=>({ok:true,json:async()=>({available:false})})});assert.equal(x,null)});
test('accepts only 896-value accepted checkpoint',async()=>{const good={available:true,status:'accepted_experimental',generation:2,values:Array(896).fill(1)};const x=await loadAcceptedResearchCheckpoint({fetcher:async()=>({ok:true,json:async()=>good})});assert.equal(x.generation,2);assert.match(checkpointBanner(x),/2/)});
test('rejects malformed checkpoint',async()=>{const bad={available:true,status:'accepted_experimental',generation:1,values:[1]};const x=await loadAcceptedResearchCheckpoint({fetcher:async()=>({ok:true,json:async()=>bad})});assert.equal(x,null)});
