/** Executable data-flow language v1. Candidate input is DATA, never host JS.
 * No eval/Function/vm, imports, network, filesystem, credentials, or host callbacks.
 * The restricted language is a bootstrap substrate, not a claim about all code.
 */
const KEYS = new Set(['output_text','output','type','content','text','role']);
const ARITY = {input:1, get:3, map_get:3, flatmap_get:3, filter_eq:4, join:3, trim:2, first_nonempty:3};
const own = (x,k) => x !== null && typeof x === 'object' && Object.hasOwn(x,k) ? x[k] : null;
const arr = x => Array.isArray(x) ? x : [];

export function checkProgram(program) {
  let count=0;
  function walk(n,depth=0) {
    if (++count>64 || depth>20) throw new Error('PROGRAM_SIZE');
    if (!Array.isArray(n) || !Object.hasOwn(ARITY,n[0]) || n.length!==ARITY[n[0]]) throw new Error('BAD_OPCODE');
    const op=n[0];
    if (['get','map_get','flatmap_get','filter_eq'].includes(op) && !KEYS.has(n[1])) throw new Error('BAD_FIELD');
    if (op==='filter_eq' && !['message','output_text','assistant'].includes(n[2])) throw new Error('BAD_LITERAL');
    if (op==='join' && !['','\n',' '].includes(n[1])) throw new Error('BAD_SEPARATOR');
    const children = op==='input' ? [] : op==='first_nonempty' ? n.slice(1) : [n[n.length-1]];
    children.forEach(x=>walk(x,depth+1));
  }
  walk(program);
  return {nodes:count, language:'PINF-DATAFLOW-1'};
}

export function execute(program,input,{maxSteps=12000,maxBytes=65536}={}) {
  checkProgram(program);
  const encoded=JSON.stringify(input);
  if (encoded===undefined || Buffer.byteLength(encoded)>maxBytes) throw new Error('INPUT_SIZE');
  // No live host objects, getters, prototypes or functions cross this boundary.
  const root=JSON.parse(encoded); let steps=0;
  const tick=(n=1)=>{ steps+=n; if(steps>maxSteps) throw new Error('STEP_LIMIT'); };
  function evaluate(p) {
    tick(); const op=p[0];
    if(op==='input') return root;
    if(op==='first_nonempty') {
      const a=evaluate(p[1]);
      return typeof a==='string'&&a.trim() ? a.trim() : evaluate(p[2]);
    }
    const x=evaluate(p[p.length-1]);
    switch(op) {
      case 'get': return own(x,p[1]);
      case 'trim': return typeof x==='string'?x.trim():'';
      case 'map_get': tick(arr(x).length); return arr(x).map(v=>own(v,p[1]));
      case 'filter_eq': tick(arr(x).length); return arr(x).filter(v=>own(v,p[1])===p[2]);
      case 'flatmap_get': {
        const out=[];
        for(const v of arr(x)){tick();const vs=arr(own(v,p[1]));tick(vs.length);out.push(...vs);}
        return out;
      }
      case 'join': tick(arr(x).length); return arr(x).filter(v=>typeof v==='string').join(p[1]);
      default: throw new Error('BAD_OPCODE');
    }
  }
  const result=evaluate(program);
  if (typeof result!=='string' || Buffer.byteLength(result)>32768) throw new Error('OUTPUT_CONTRACT');
  return {value:result,steps};
}

export function legacyProgram(){return ['trim',['get','output_text',['input']]];}

/** Enumerative program synthesis: competing traversals/filters are generated,
 * scored on development examples, and only ONE frozen winner reaches holdout.
 */
export function* candidates(){
  for(const shortcut of [false,true]) for(const messageFilter of [false,true])
  for(const textFilter of [false,true]) for(const separator of ['','\n']) {
    let x=['get','output',['input']];
    if(messageFilter) x=['filter_eq','type','message',x];
    x=['flatmap_get','content',x];
    if(textFilter) x=['filter_eq','type','output_text',x];
    x=['trim',['join',separator,['map_get','text',x]]];
    if(shortcut) x=['first_nonempty',['get','output_text',['input']],x];
    yield x;
  }
}

export function compile(program){
  checkProgram(program);
  // Trusted compiler emits only a checked JSON literal, not model-authored JS.
  return '// Generated executable module; do not edit the evaluator to pass tests.\n'+
    'import { execute } from "../src/program.js";\n'+
    'export const program = '+JSON.stringify(program)+';\n'+
    'export default input => execute(program,input).value;\n';
}
