// Generated executable module; do not edit the evaluator to pass tests.
import { execute } from "../src/program.js";
export const program = ["first_nonempty",["get","output_text",["input"]],["trim",["join","\n",["map_get","text",["filter_eq","type","output_text",["flatmap_get","content",["filter_eq","type","message",["get","output",["input"]]]]]]]]];
export default input => execute(program,input).value;
