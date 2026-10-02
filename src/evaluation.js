import { createHash } from 'node:crypto';

// Independent, non-generated reference implementation. Does not call the VM,
// program generator, LLM or candidate. Shared contract/author are disclosed.
export function oracle(r) {
  if(r===null||typeof r!=='object')return '';
  if(typeof r.output_text==='string'&&r.output_text.trim())return r.output_text.trim();
  const texts=[];
  if(Array.isArray(r.output))for(const m of r.output) {
    if(!m||m.type!=='message'||!Array.isArray(m.content))continue;
    for(const p of m.content)if(p&&p.type==='output_text'&&typeof p.text==='string')texts.push(p.text);
  }
  return texts.join('\n').trim();
}
const part=text=>({type:'output_text',text,annotations:[]});
const msg=content=>({type:'message',role:'assistant',content});
const FAMILIES=['shortcut','raw_message','several_parts','tool_before_message','non_message_text','refusal_noise','bad_shape','empty_shortcut','unicode','nested_decoy','mixed_types','shortcut_precedence'];
export function fixtures(seed,repeats=8){
  if(!Number.isInteger(repeats)||repeats<1||repeats>50)throw new Error('SAMPLE_LIMIT');
  const rows=[];
  for(let i=0;i<repeats;i++)for(const family of FAMILIES){
    const t=createHash('sha256').update(`${seed}/${family}/${i}`).digest('hex').slice(0,12);
    const a=`回答-${t} 日本語`, b=`続き-${t} Ω`;
    const patterns={
      shortcut:{output_text:` ${a} `},
      raw_message:{output:[msg([part(a)])]},
      several_parts:{output:[msg([part(a),part(b)])]},
      tool_before_message:{output:[{type:'reasoning',summary:[]},{type:'web_search_call',id:t},msg([part(a)])]},
      non_message_text:{output:[{type:'function_call',content:[part('decoy')]},msg([part(a)])]},
      refusal_noise:{output:[msg([{type:'refusal',refusal:'declined',text:'do not treat refusal as an answer'},part(a)])]},
      bad_shape:i%2?{output:[null,{type:'message',content:null}]}:{output:'not_an_array'},
      empty_shortcut:{output_text:i%2?'  ':null,output:[msg([part(a)])]},
      unicode:{output:[msg([part(`\t${a}\n😀`),part(b)])]},
      nested_decoy:{output:[{type:'tool',content:[part('ignore')]},msg([null,part(a),{type:'image',text:'ignore'}])]},
      mixed_types:{output:[msg([part(42),part(a),{type:'input_text',text:'ignore'}])]},
      shortcut_precedence:{output_text:a,output:[msg([part(b)])]}
    };
    const input=patterns[family];rows.push({id:`${family}/${i}`,family,input,expected:oracle(input)});
  }
  return rows;
}
export function score(rows,outputs){
  if(rows.length!==outputs.length)throw new Error('MISSING_RUNS');
  const details=rows.map((r,i)=>({id:r.id,family:r.family,pass:outputs[i].ok&&outputs[i].value===r.expected,steps:outputs[i].steps??null,error:outputs[i].error??null}));
  return {n:rows.length,passed:details.filter(x=>x.pass).length,accuracy:details.filter(x=>x.pass).length/rows.length,details};
}
export function comparison(rows,base,child){
  const before=score(rows,base),after=score(rows,child);
  const groups=FAMILIES.map(f=>{
    const indices=rows.map((r,i)=>r.family===f?i:-1).filter(i=>i>=0);
    const delta=indices.reduce((s,i)=>s+Number(after.details[i].pass)-Number(before.details[i].pass),0)/indices.length;
    return {family:f,delta};
  });
  // Cluster bootstrap resamples task families, not correlated generated items.
  let s=918273;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  const boot=Array.from({length:2000},()=>groups.reduce(sum=>sum+groups[Math.floor(random()*groups.length)].delta,0)/groups.length).sort((a,b)=>a-b);
  const regressions=before.details.filter((x,i)=>x.pass&&!after.details[i].pass).length;
  return {before,after,delta:after.accuracy-before.accuracy,regressions,ci95:[boot[49],boot[1949]],ciInterpretation:'task-family bootstrap within this synthetic contract suite; not a general-intelligence CI',groups};
}
export const protocol=Object.freeze({version:'PINF-ACC-EXTRACT-1',scope:'response-text-extraction',minGain:0.05,requirePerfectContract:true,regressionsAllowed:0,maxCandidates:16,devRepeats:2,confirmRepeats:12,replicationRepeats:12,stopping:'one selected candidate, one fresh confirmatory and one fresh replication; no post-result tuning',promotion:'bounded module only; never app privileges, evaluator, thresholds or model weights'});
export function accept(c,r){
  return c.after.passed===c.after.n&&r.after.passed===r.after.n&&c.regressions===0&&r.regressions===0&&c.delta>=protocol.minGain&&r.delta>=protocol.minGain&&c.ci95[0]>0&&r.ci95[0]>0;
}
