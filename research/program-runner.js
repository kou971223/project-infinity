import {executeProgram} from './program.js';
let input='';for await(const s of process.stdin){input+=s;if(input.length>60000)throw Error('INPUT_SIZE');}
const {program,cases}=JSON.parse(input);if(!Array.isArray(cases)||cases.length>64)throw Error('CASE_LIMIT');
process.stdout.write(JSON.stringify(cases.map(c=>{try{return {reply:executeProgram(program,c.args)};}catch(e){return {error:e.message};}})));
