import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.new';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file);}
export class Archive {
  constructor(dir){this.dir=dir;fs.mkdirSync(dir,{recursive:true});this.events=path.join(dir,'events.jsonl');this.pointer=path.join(dir,'active.json');this.verify();}
  read(){return fs.existsSync(this.events)?fs.readFileSync(this.events,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];}
  verify(){let prev='GENESIS';let seq=0;for(const e of this.read()){const {digest,...body}=e;if(body.previous!==prev||body.seq!==++seq||hash(body)!==digest)throw new Error('AUDIT_TAMPER');prev=digest;}return {valid:true,events:seq,head:prev};}
  append(type,payload){const v=this.verify();const body={seq:v.events+1,previous:v.head,at:new Date().toISOString(),type,payload};const e={...body,digest:hash(body)};fs.appendFileSync(this.events,JSON.stringify(e)+'\n');return e;}
  active(){this.verify();if(!fs.existsSync(this.pointer))return null;const a=JSON.parse(fs.readFileSync(this.pointer,'utf8'));if(hash(a.program)!==a.id)throw new Error('ACTIVE_ARTIFACT_TAMPER');const last=this.read().filter(e=>['ADOPT','BOOTSTRAP','ROLLBACK'].includes(e.type)).at(-1);const expected=last?.type==='ROLLBACK'?last.payload.to:last?.payload.id;if(a.id!==expected)throw new Error('ACTIVE_POINTER_TAMPER');return a;}
  seed(program){if(!this.active()){const a={id:hash(program),program,parent:null,evidence:[],kind:'bootstrap'};this.append('BOOTSTRAP',a);atomic(this.pointer,a);}return this.active();}
  // Authority object is created by the orchestrator, never accepted from HTTP or a candidate.
  promote(program,parent,evidence,authority){
    if(authority?.role!=='validator'||authority?.verified!==true)throw new Error('PROMOTION_DENIED');
    if(this.active()?.id!==parent)throw new Error('STALE_PARENT');
    const a={id:hash(program),program,parent,evidence,kind:'validated-bounded-module'};
    this.append('ADOPT',a);atomic(this.pointer,a);return a;
  }
  rollback(reason,authority){
    if(authority?.role!=='validator'&&authority?.role!=='operator')throw new Error('ROLLBACK_DENIED');
    const cur=this.active();if(!cur?.parent)throw new Error('NO_PARENT');
    const prior=this.read().filter(e=>['ADOPT','BOOTSTRAP'].includes(e.type)&&e.payload.id===cur.parent).at(-1)?.payload;
    if(!prior)throw new Error('PARENT_MISSING');
    this.append('ROLLBACK',{from:cur.id,to:prior.id,reason});atomic(this.pointer,prior);return prior;
  }
  invalidate(evidenceId,reason){
    this.append('EVIDENCE_INVALIDATED',{id:evidenceId,reason});
    const affected=new Set([evidenceId]);let added=true;
    while(added){added=false;for(const e of this.read().filter(x=>x.type==='DEPENDENCY'))if(e.payload.parents.some(p=>affected.has(p))&&!affected.has(e.payload.id)){affected.add(e.payload.id);added=true;}}
    this.append('REVALIDATION_REQUIRED',{affected:[...affected]});
    const current=this.active();
    let cursor=current,steps=0;while(cursor&&(affected.has(cursor.id)||cursor.evidence.some(e=>affected.has(e)))){if(!cursor.parent)throw new Error('NO_VALID_FALLBACK');cursor=this.rollback('upstream_evidence_invalidated',{role:'validator'});if(++steps>100)throw new Error('LINEAGE_DEPTH');}
    return [...affected];
  }
}
