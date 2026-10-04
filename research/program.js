/** Candidate programs are bounded arithmetic trees, never JavaScript or executable text. */
import {hash} from '../evolution/runtime.js';
export const TASKS=['percentage','discount','mean','rectangle'];
const variables={percentage:['amount','rate'],discount:['amount','rate'],mean:['a','b','c'],rectangle:['width','height']};
export function validateProgram(p){
 if(!p||!TASKS.includes(p.task)||typeof p.hypothesis!=='string'||p.hypothesis.length>400||Object.keys(p).sort().join(',')!=='expression,hypothesis,task')throw Error('PROGRAM_SCHEMA');
 let nodes=0;
 function visit(x,depth){
  if(++nodes>48||depth>8||!Array.isArray(x))throw Error('PROGRAM_LIMIT');
  if(x[0]==='var'&&x.length===2&&variables[p.task].includes(x[1]))return;
  if(x[0]==='const'&&x.length===2&&typeof x[1]==='string'&&/^-?\d{1,6}$/.test(x[1]))return;
  if(!['add','sub','mul','div'].includes(x[0])||x.length!==3)throw Error('PROGRAM_OPCODE');
  visit(x[1],depth+1);visit(x[2],depth+1);
 }
 visit(p.expression,0);return nodes;
}
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};
function rational(n,d=1n){if(d===0n)throw Error('DIVISION_ZERO');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);n/=g;d/=g;if(String(n).length>200||String(d).length>200)throw Error('NUMERIC_LIMIT');return [n,d];}
function number(s){if(typeof s!=='string'||!/^[-+]?\d{1,16}(?:\.\d{1,6})?$/.test(s))throw Error('INPUT_NUMBER');const a=s.split('.');return rational(BigInt(a.join('')),10n**BigInt(a[1]?.length||0));}
export function executeProgram(p,args){
 validateProgram(p);if(Object.keys(args).sort().join(',')!==variables[p.task].slice().sort().join(','))throw Error('PROGRAM_ARGUMENTS');
 const values=Object.fromEntries(Object.entries(args).map(([k,v])=>[k,number(v)]));
 function evaluate(x){if(x[0]==='var')return values[x[1]];if(x[0]==='const')return [BigInt(x[1]),1n];const [a,b]=evaluate(x[1]),[c,d]=evaluate(x[2]);return x[0]==='add'?rational(a*d+c*b,b*d):x[0]==='sub'?rational(a*d-c*b,b*d):x[0]==='mul'?rational(a*c,b*d):rational(a*d,b*c);}
 const [n,d]=evaluate(p.expression);return d===1n?String(n):`${n}/${d}`;
}
export function parseTask(text){
 if(typeof text!=='string'||text.length>160)return null;
 const s=text.trim().replace(/^計算[:：]\s*/,''),n='([-+]?\\d{1,16}(?:\\.\\d{1,6})?)';let m;
 if((m=new RegExp('^'+n+'(?:円)?\\s*の\\s*'+n+'\\s*[%％](?:は[?？]?)?$').exec(s)))return {task:'percentage',args:{amount:m[1],rate:m[2]}};
 if((m=new RegExp('^'+n+'(?:円)?\\s*の\\s*'+n+'\\s*[%％]引き(?:は[?？]?)?$').exec(s)))return {task:'discount',args:{amount:m[1],rate:m[2]}};
 if((m=new RegExp('^(?:平均[:：]?\\s*)'+n+'\\s*[,、]\\s*'+n+'\\s*[,、]\\s*'+n+'$').exec(s)))return {task:'mean',args:{a:m[1],b:m[2],c:m[3]}};
 if((m=new RegExp('^長方形\\s*'+n+'\\s*[×x*]\\s*'+n+'\\s*の面積$').exec(s)))return {task:'rectangle',args:{width:m[1],height:m[2]}};
 return null;
}
export function oracle(task,a){
 // Trusted runtime probes only; research acceptance uses separate Python Fraction implementation.
 const formulas={percentage:['div',['mul',['var','amount'],['var','rate']],['const','100']],discount:['div',['mul',['var','amount'],['sub',['const','100'],['var','rate']]],['const','100']],mean:['div',['add',['add',['var','a'],['var','b']],['var','c']],['const','3']],rectangle:['mul',['var','width'],['var','height']]};
 return executeProgram({task,expression:formulas[task],hypothesis:'trusted regression probe'},a);
}
export function verifyProgramRecord(x){
 if(!x||x.schema!=='PINF-PROGRAMS-1'||!Number.isSafeInteger(x.generation)||x.generation<1||!Array.isArray(x.programs)||x.programs.length>4)throw Error('PROGRAM_RECORD');
 const {artifactHash,...body}=x;if(hash(body)!==artifactHash)throw Error('PROGRAM_HASH');
 if(new Set(x.programs.map(p=>p.program?.task)).size!==x.programs.length)throw Error('PROGRAM_DUPLICATE');
 for(const entry of x.programs){validateProgram(entry.program);const e=entry.evidence;
  if(e?.protocol!=='PINF-PROGRAM-TEST-1'||e.candidateHash!==hash(entry.program)||e.passed!==true||!Array.isArray(e.cases)||e.cases.length!==64)throw Error('PROGRAM_UNVERIFIED');
  for(const c of e.cases)if(oracle(entry.program.task,c.args)!==c.expected||executeProgram(entry.program,c.args)!==c.expected)throw Error('PROGRAM_REGRESSION');
 }return x;
}
