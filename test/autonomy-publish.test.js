import test from 'node:test';import assert from 'node:assert/strict';
import {canonical,digest,checkPacket,checkCandidate,summary} from '../autonomy/packet.mjs';
import {publish} from '../autonomy/publish.mjs';
const SHA='a'.repeat(40);
function fixture(){const x={schema:'PINF-AUTONOMY-1',generation:1,sourceCommit:SHA,runId:'123',history:[],sources:[],parentRecordHash:null,promoted:false,overallProjectAccepted:false,cost:{paidInferenceCalls:0,newPaidServices:0},decision:'NO_CHANGE',candidate:null};return {...x,recordHash:digest(x)};}
test('canonical data has stable order',()=>assert.equal(canonical({b:1,a:'日本語'}),'{"a":"日本語","b":1}'));
test('publication packet rejects fake promotion',()=>{const x=fixture();x.promoted=true;x.recordHash=digest(Object.fromEntries(Object.entries(x).filter(([k])=>k!=='recordHash')));assert.throws(()=>checkPacket(x),/AUTHORITY/);});
test('tampered evidence refused',()=>{const x=fixture();x.generation=8;assert.throws(()=>checkPacket(x),/HASH/);});
test('publisher requires credentials',async()=>{await assert.rejects(publish(fixture(),{token:''}),/CREDENTIAL/);});
test('data publisher never writes main',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{
   calls.push([url,opts.method,opts.body?JSON.parse(opts.body):null]);
   let value={};if(url.endsWith('git/ref/heads/research-records'))value={object:{sha:'state'}};
   else if(url.includes('git/commits/state'))value={tree:{sha:'tree'}};
   else if(url.includes('contents/autonomy/latest'))return new Response('{}',{status:404});
   else if(url.endsWith('git/trees'))value={sha:'newtree'};
   else if(url.endsWith('git/commits'))value={sha:'newcommit'};
   return Response.json(value);
 };
 const r=await publish(fixture(),{token:'test-only',fetcher});assert.equal(r.published,true);
 const writes=calls.filter(c=>c[1]!=='GET');assert.equal(writes.length,3);
 assert(writes.at(-1)[0].endsWith('git/refs/heads/research-records'));assert.equal(writes.at(-1)[2].force,false);
 assert(!writes.some(c=>c[0].endsWith('/main')||c[0].includes('/pulls')));
});
test('missing source branches cannot count as deployment',()=>{const x=summary(fixture());assert.equal(x.productionPromotion,false);assert.equal(x.overallProjectAccepted,false);});
test('lineage compare-and-swap blocks stale publication',async()=>{
 const old=fixture();const fetcher=async(url)=>{
 if(url.endsWith('research-records'))return Response.json({object:{sha:'state'}});
 if(url.includes('/git/commits/'))return Response.json({tree:{sha:'tree'}});
 return Response.json({content:Buffer.from(JSON.stringify(old)).toString('base64')});
 };
 await assert.rejects(publish(fixture(),{token:'test',fetcher}),/STALE_LINEAGE/);
});
test('candidate privileges and protected paths rejected even with recomputed hash',()=>{
 const c={schema:'PINF-SOURCE-CANDIDATE-1',baseSha:SHA,authority:'candidate-branch-only',protocol:{id:'PINF-SOURCE-REVIEW-1',promotion:'review_branch_only'},changes:[{path:'.github/workflows/ci.yml',before:'x',after:'y',content:'y',afterHash:digest('y')}]};c.candidateHash=digest(c);
 assert.throws(()=>checkCandidate(c,SHA),/PATH_DENIED/);
});
