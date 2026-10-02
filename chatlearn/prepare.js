import fs from 'node:fs';
import {sha256,canonical,validateManifest} from './manifest.js';
const r=JSON.parse(fs.readFileSync('reports/chat-candidate.json','utf8'));
// Public operational test outputs are retained even on rejection; no private conversations.
console.log(JSON.stringify({result:r.result,evidence:r.evidence,conversion:r.conversion,runtime:r.runtime},null,2));
if(r.status==='completed'&&r.decision==='ADOPT_CHAT_EXPERIMENTAL_NORM'){
 const m={...r.release,releaseHash:await sha256(canonical(r.release))};await validateManifest(m);
 fs.writeFileSync('reports/chat-release.test.json',JSON.stringify(m));
 console.log(JSON.stringify({prepared:true,releaseHash:m.releaseHash,weightHash:m.weightHash}));
}else console.log(JSON.stringify({prepared:false,decision:r.decision,status:r.status}));
